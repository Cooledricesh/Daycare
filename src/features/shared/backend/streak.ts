import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { fetchAllPaginated } from '@/lib/supabase-pagination';
import { isWeekend, getHolidayDatesMap } from '@/lib/business-days';
import { format, subDays, parseISO } from 'date-fns';
import { getStreakTier, type StreakTier } from '@/features/shared/lib/streak-tier';

export type PatientStreaks = {
  attendance_streak: number;
  consultation_streak: number;
  streak_tier: StreakTier;
};

/** 스트릭 계산 윈도우 (일) */
const STREAK_WINDOW_DAYS = 60;

/**
 * 해당 날짜가 환자에게 "예정"된 날인지 판단
 * - scheduled_attendances(is_cancelled=false) 재료화 row가 있으면 예정
 * - 없어도 scheduled_patterns 요일 매칭이면 예정 (history backfill)
 * - is_cancelled=true 재료화 row가 있으면 취소로 처리 → !예정
 * - 환자 등록일 이전은 예정 아님
 */
export function isScheduledOnDate(
  dateStr: string,
  dow: number,
  scheduledMaterialized: Set<string>,
  cancelledMaterialized: Set<string>,
  patternDows: Set<number>,
  patientCreatedDate: string,
): boolean {
  if (dateStr < patientCreatedDate) return false;
  if (cancelledMaterialized.has(dateStr)) return false;
  return scheduledMaterialized.has(dateStr) || patternDows.has(dow);
}

/**
 * 자동 휴원일 감지: 윈도우 내 "평일이지만 전체 출석자가 0명"인 날을 휴원일로 간주.
 * - endDate(오늘)는 제외 (오전 중 미출석 상태를 휴원으로 오인 방지)
 * - 주말은 제외 (어차피 스트릭 계산에서 skip)
 */
export function detectClosureDates(
  attendedDatesAnyPatient: Set<string>,
  startDate: string,
  endDate: string,
): Set<string> {
  const closures = new Set<string>();
  // endDate 제외하고 하루 전부터 시작
  let cursor = subDays(parseISO(endDate), 1);
  while (true) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    if (dateStr < startDate) break;
    if (!isWeekend(dateStr) && !attendedDatesAnyPatient.has(dateStr)) {
      closures.add(dateStr);
    }
    cursor = subDays(cursor, 1);
  }
  return closures;
}

/**
 * 연속 출석 일수 계산 (오늘 포함, 역순)
 * - 출석 기록 있으면 무조건 카운트
 * - 주말/공휴일(holidayMap, 자동 휴원 포함) 미출석이면 skip
 * - 평일 미출석 + 예정된 날 → break
 * - 평일 미출석 + 예정 아님 → skip
 * - 환자 등록일 이전이면 종료
 */
export function calculateConsecutiveAttendance(
  scheduledMaterialized: Set<string>,
  cancelledMaterialized: Set<string>,
  patternDows: Set<number>,
  attendedDates: Set<string>,
  patientCreatedDate: string,
  holidayMap: Map<string, string>,
  endDate: string,
): number {
  let count = 0;
  let cursor = parseISO(endDate);

  for (let i = 0; i < 365; i++) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    if (patientCreatedDate && dateStr < patientCreatedDate) break;

    const isAttended = attendedDates.has(dateStr);
    if (isAttended) {
      count++;
      cursor = subDays(cursor, 1);
      continue;
    }

    const isHolidayOrWeekend = isWeekend(dateStr) || holidayMap.has(dateStr);
    if (isHolidayOrWeekend) {
      cursor = subDays(cursor, 1);
      continue;
    }

    const isScheduled = isScheduledOnDate(
      dateStr, cursor.getDay(), scheduledMaterialized, cancelledMaterialized, patternDows, patientCreatedDate,
    );
    if (isScheduled) break;

    cursor = subDays(cursor, 1);
  }
  return count;
}

/**
 * 연속 진찰 일수 계산
 * - 주말/공휴일: 출석했으면 카운트, 미출석이면 skip
 * - 평일 출석+진찰 → 카운트, 평일 출석+미진찰 → break
 * - 평일 미출석 + 예정 → break, 예정 아님 → skip
 */
export function calculateConsecutiveConsultation(
  scheduledMaterialized: Set<string>,
  cancelledMaterialized: Set<string>,
  patternDows: Set<number>,
  attendedDates: Set<string>,
  consultedDates: Set<string>,
  patientCreatedDate: string,
  holidayMap: Map<string, string>,
  endDate: string,
): number {
  let count = 0;
  let cursor = parseISO(endDate);

  for (let i = 0; i < 365; i++) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    if (patientCreatedDate && dateStr < patientCreatedDate) break;

    const isAttended = attendedDates.has(dateStr);
    const isHolidayOrWeekend = isWeekend(dateStr) || holidayMap.has(dateStr);

    if (isHolidayOrWeekend) {
      if (isAttended) count++;
      cursor = subDays(cursor, 1);
      continue;
    }

    if (isAttended) {
      if (!consultedDates.has(dateStr)) break;
      count++;
      cursor = subDays(cursor, 1);
      continue;
    }

    const isScheduled = isScheduledOnDate(
      dateStr, cursor.getDay(), scheduledMaterialized, cancelledMaterialized, patternDows, patientCreatedDate,
    );
    if (isScheduled) break;

    cursor = subDays(cursor, 1);
  }
  return count;
}

/**
 * 전 활성 환자의 raw 스트릭 맵을 계산한다 (today별 표시 보정은 호출측 책임).
 * - 60일 윈도우 데이터를 페이지네이션으로 로드
 * - holidays + 자동 휴원 감지를 합산
 */
export async function getStreaksMap(
  supabase: SupabaseClient<Database>,
  endDate: string,
  patients: Array<{ id: string; created_at: string | null }>,
): Promise<Map<string, PatientStreaks>> {
  const startDate = format(subDays(parseISO(endDate), STREAK_WINDOW_DAYS), 'yyyy-MM-dd');

  const [allAttendances, allConsultations, allScheduled, allPatterns, holidayMap] = await Promise.all([
    fetchAllPaginated<{ patient_id: string; date: string }>(() =>
      supabase.from('attendances').select('patient_id, date').gte('date', startDate).lte('date', endDate).order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; date: string }>(() =>
      supabase.from('consultations').select('patient_id, date').gte('date', startDate).lte('date', endDate).order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; date: string; is_cancelled: boolean }>(() =>
      supabase.from('scheduled_attendances').select('patient_id, date, is_cancelled').gte('date', startDate).lte('date', endDate).order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; day_of_week: number }>(() =>
      supabase.from('scheduled_patterns').select('patient_id, day_of_week').eq('is_active', true).order('id'),
    ),
    getHolidayDatesMap(supabase, startDate, endDate),
  ]);

  const patientAttendanceDates = new Map<string, Set<string>>();
  const patientConsultationDates = new Map<string, Set<string>>();
  const patientScheduledDates = new Map<string, Set<string>>();
  const patientCancelledDates = new Map<string, Set<string>>();
  const patientPatternDows = new Map<string, Set<number>>();
  const attendedDatesAnyPatient = new Set<string>();

  for (const a of allAttendances ?? []) {
    const set = patientAttendanceDates.get(a.patient_id) ?? new Set<string>();
    set.add(a.date);
    patientAttendanceDates.set(a.patient_id, set);
    attendedDatesAnyPatient.add(a.date);
  }
  for (const c of allConsultations ?? []) {
    const set = patientConsultationDates.get(c.patient_id) ?? new Set<string>();
    set.add(c.date);
    patientConsultationDates.set(c.patient_id, set);
  }
  for (const s of allScheduled ?? []) {
    const target = s.is_cancelled ? patientCancelledDates : patientScheduledDates;
    const set = target.get(s.patient_id) ?? new Set<string>();
    set.add(s.date);
    target.set(s.patient_id, set);
  }
  for (const p of allPatterns ?? []) {
    const set = patientPatternDows.get(p.patient_id) ?? new Set<number>();
    set.add(p.day_of_week);
    patientPatternDows.set(p.patient_id, set);
  }

  // 자동 휴원 감지 → holidayMap에 합산
  const closures = detectClosureDates(attendedDatesAnyPatient, startDate, endDate);
  for (const d of closures) {
    if (!holidayMap.has(d)) holidayMap.set(d, '자동 휴원 감지');
  }

  const result = new Map<string, PatientStreaks>();
  for (const patient of patients) {
    const pScheduled = patientScheduledDates.get(patient.id) ?? new Set<string>();
    const pCancelled = patientCancelledDates.get(patient.id) ?? new Set<string>();
    const pAttended = patientAttendanceDates.get(patient.id) ?? new Set<string>();
    const pConsulted = patientConsultationDates.get(patient.id) ?? new Set<string>();
    const pPatternDows = patientPatternDows.get(patient.id) ?? new Set<number>();
    const createdDate = (patient.created_at ?? '').slice(0, 10);

    const attendance_streak = calculateConsecutiveAttendance(
      pScheduled, pCancelled, pPatternDows, pAttended, createdDate, holidayMap, endDate,
    );
    const consultation_streak = calculateConsecutiveConsultation(
      pScheduled, pCancelled, pPatternDows, pAttended, pConsulted, createdDate, holidayMap, endDate,
    );
    result.set(patient.id, {
      attendance_streak,
      consultation_streak,
      streak_tier: getStreakTier(attendance_streak),
    });
  }
  return result;
}

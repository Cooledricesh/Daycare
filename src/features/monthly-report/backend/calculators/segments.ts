import type { SupabaseClient } from '@supabase/supabase-js';
import {
  eachDayOfInterval,
  isWeekend,
  startOfMonth,
  endOfMonth,
  parseISO,
  format,
} from 'date-fns';
import type { Database } from '@/lib/supabase/types';
import type {
  TopAttenderEntry,
  RiskPatientEntry,
  NewPatientEntry,
} from '../schema';
import { fetchAllWithPagination, getHolidayDates } from './attendance';
import {
  TOP_ATTENDERS_COUNT,
  TOP_ATTENDERS_MIN_POSSIBLE_DAYS,
  RISK_PATIENTS_MAX_COUNT,
  RISK_ATTENDANCE_RATE_THRESHOLD,
  RISK_CONSECUTIVE_ABSENCE_DAYS,
} from '../../constants/thresholds';

type Supabase = SupabaseClient<Database>;

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * 환자의 최장 연속 결석 일수를 계산합니다
 */
function getLongestConsecutiveAbsence(
  scheduledDates: Set<string>,
  attendedDates: Set<string>,
  workingDays: string[],
): number {
  let longest = 0;
  let current = 0;

  for (const dateStr of workingDays) {
    if (!scheduledDates.has(dateStr)) {
      current = 0;
      continue;
    }
    if (attendedDates.has(dateStr)) {
      current = 0;
    } else {
      current += 1;
      longest = Math.max(longest, current);
    }
  }

  return longest;
}

/**
 * 출석 우수 환자 목록을 반환합니다 (spec §4.7)
 * 상위 TOP_ATTENDERS_COUNT 명, 재원기간 < TOP_ATTENDERS_MIN_POSSIBLE_DAYS 인 환자 제외
 */
export async function getTopAttenders(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<TopAttenderEntry[]> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const monthStartStr = formatDate(monthStart);
  const monthEndStr = formatDate(monthEnd);

  // active 환자 목록
  const patients = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, display_name')
      .eq('status', 'active')
      .range(from, to);
    if (error) throw new Error(`환자 조회 실패: ${error.message}`);
    return data ?? [];
  });

  // 해당 월 예정 출석 (possible days 계산용)
  const scheduled = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('scheduled_attendances')
      .select('patient_id, date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .eq('is_cancelled', false)
      .range(from, to);
    if (error) throw new Error(`예정 출석 조회 실패: ${error.message}`);
    return data ?? [];
  });

  // 해당 월 실제 출석
  const attendances = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('patient_id, date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .range(from, to);
    if (error) throw new Error(`출석 조회 실패: ${error.message}`);
    return data ?? [];
  });

  // 환자별 집계
  const scheduledByPatient = new Map<string, number>();
  for (const sch of scheduled) {
    scheduledByPatient.set(sch.patient_id, (scheduledByPatient.get(sch.patient_id) ?? 0) + 1);
  }

  const attendedByPatient = new Map<string, number>();
  for (const att of attendances) {
    attendedByPatient.set(att.patient_id, (attendedByPatient.get(att.patient_id) ?? 0) + 1);
  }

  const entries: TopAttenderEntry[] = patients
    .map((p) => {
      const possibleDays = scheduledByPatient.get(p.id) ?? 0;
      const attendedDays = attendedByPatient.get(p.id) ?? 0;
      const rate = possibleDays > 0 ? Math.min((attendedDays / possibleDays) * 100, 100) : 0;
      return {
        patient_id: p.id,
        name: p.display_name ?? p.name,
        attendance_days: attendedDays,
        attendance_rate: Math.round(rate * 100) / 100,
        possible_days: possibleDays,
      };
    })
    .filter((e) => e.possible_days >= TOP_ATTENDERS_MIN_POSSIBLE_DAYS)
    .sort((a, b) => b.attendance_days - a.attendance_days)
    .slice(0, TOP_ATTENDERS_COUNT)
    .map(({ possible_days: _pd, ...rest }) => rest);

  return entries;
}

/**
 * 집중 관리 대상 환자 목록을 반환합니다 (spec §4.6)
 * 출석률 < 50% 또는 최장 연속 결석 >= 5일
 */
export async function getRiskPatients(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<RiskPatientEntry[]> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const monthStartStr = formatDate(monthStart);
  const monthEndStr = formatDate(monthEnd);

  const allWorkingDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    .filter((d) => !isWeekend(d))
    .map(formatDate);

  const patients = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, display_name')
      .eq('status', 'active')
      .range(from, to);
    if (error) throw new Error(`환자 조회 실패: ${error.message}`);
    return data ?? [];
  });

  const scheduled = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('scheduled_attendances')
      .select('patient_id, date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .eq('is_cancelled', false)
      .range(from, to);
    if (error) throw new Error(`예정 출석 조회 실패: ${error.message}`);
    return data ?? [];
  });

  const attendances = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('patient_id, date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .range(from, to);
    if (error) throw new Error(`출석 조회 실패: ${error.message}`);
    return data ?? [];
  });

  const scheduledByPatient = new Map<string, Set<string>>();
  for (const sch of scheduled) {
    if (!scheduledByPatient.has(sch.patient_id)) scheduledByPatient.set(sch.patient_id, new Set());
    scheduledByPatient.get(sch.patient_id)!.add(sch.date);
  }

  const attendedByPatient = new Map<string, Set<string>>();
  for (const att of attendances) {
    if (!attendedByPatient.has(att.patient_id)) attendedByPatient.set(att.patient_id, new Set());
    attendedByPatient.get(att.patient_id)!.add(att.date);
  }

  const riskList: (RiskPatientEntry & { _sort_key: number })[] = [];

  for (const patient of patients) {
    const scheduledSet = scheduledByPatient.get(patient.id) ?? new Set<string>();
    const attendedSet = attendedByPatient.get(patient.id) ?? new Set<string>();

    const possibleDays = scheduledSet.size;
    if (possibleDays === 0) continue;

    const attendedDays = attendedSet.size;
    const rate = Math.min((attendedDays / possibleDays) * 100, 100);
    const longestAbsence = getLongestConsecutiveAbsence(scheduledSet, attendedSet, allWorkingDays);

    const isRisk =
      rate < RISK_ATTENDANCE_RATE_THRESHOLD ||
      longestAbsence >= RISK_CONSECUTIVE_ABSENCE_DAYS;

    if (!isRisk) continue;

    riskList.push({
      patient_id: patient.id,
      name: patient.display_name ?? patient.name,
      attendance_days: attendedDays,
      attendance_rate: Math.round(rate * 100) / 100,
      longest_consecutive_absence: longestAbsence,
      _sort_key: rate,
    });
  }

  return riskList
    .sort((a, b) => b.longest_consecutive_absence - a.longest_consecutive_absence || a._sort_key - b._sort_key)
    .slice(0, RISK_PATIENTS_MAX_COUNT)
    .map(({ _sort_key: _sk, ...rest }) => rest);
}

/**
 * 신규 환자 정착도 데이터를 반환합니다 (spec §4.8)
 */
export async function getNewPatients(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<NewPatientEntry[]> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const monthStartStr = formatDate(monthStart);
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const holidayDates = await getHolidayDates(supabase, year, month);

  const newPatients = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, display_name, created_at')
      .gte('created_at', monthStartStr)
      .lt('created_at', nextMonth)
      .range(from, to);
    if (error) throw new Error(`신규 환자 조회 실패: ${error.message}`);
    return data ?? [];
  });

  if (newPatients.length === 0) return [];

  const patientIds = newPatients.map((p) => p.id);

  const attendances = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('patient_id, date')
      .in('patient_id', patientIds)
      .gte('date', monthStartStr)
      .lte('date', formatDate(monthEnd))
      .range(from, to);
    if (error) throw new Error(`출석 조회 실패: ${error.message}`);
    return data ?? [];
  });

  const attendedByPatient = new Map<string, number>();
  for (const att of attendances) {
    attendedByPatient.set(att.patient_id, (attendedByPatient.get(att.patient_id) ?? 0) + 1);
  }

  return newPatients.map((patient) => {
    const registeredDate = patient.created_at.slice(0, 10);
    const regDate = parseISO(registeredDate);
    const afterReg = eachDayOfInterval({ start: regDate, end: monthEnd });

    const possibleDays = afterReg.filter((d) => {
      if (isWeekend(d)) return false;
      return !holidayDates.has(formatDate(d));
    }).length;

    return {
      patient_id: patient.id,
      name: patient.display_name ?? patient.name,
      registered_date: registeredDate,
      attendance_days: attendedByPatient.get(patient.id) ?? 0,
      possible_days: possibleDays,
    };
  });
}

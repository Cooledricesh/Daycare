import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { fetchAllPaginated } from '@/lib/supabase-pagination';
import type {
  GetAttendanceBoardParams,
  BoardPatient,
  RoomGroup,
  AttendanceBoardResponse,
  StreakTier,
  AttendanceStatus,
} from './schema';
import { AttendanceBoardError, AttendanceBoardErrorCode } from './error';
import { getTodayString } from '@/lib/date';
import { ensureScheduleGenerated } from '@/server/services/schedule';
import { isWeekend, getHolidayDatesMap } from '@/lib/business-days';
import { format, subDays, parseISO } from 'date-fns';

interface RoomMappingWithCoordinator {
  room_prefix: string;
  coordinator: { name: string } | null;
}


/** 스트릭 수 → 등급 */
function getStreakTier(streak: number): StreakTier {
  if (streak >= 30) return 'myth';
  if (streak >= 20) return 'crown';
  if (streak >= 10) return 'diamond';
  if (streak >= 5) return 'lightning';
  if (streak >= 3) return 'fire';
  return 'none';
}

/**
 * 해당 날짜가 환자에게 "예정"된 날인지 판단
 * - scheduled_attendances(is_cancelled=false) 재료화 row가 있으면 예정
 * - 없어도 scheduled_patterns 요일 매칭이면 예정 (history backfill)
 * - is_cancelled=true 재료화 row가 있으면 취소로 처리 → !예정
 * - 환자 등록일 이전은 예정 아님
 */
function isScheduledOnDate(
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
 * 연속 출석 일수 계산 (오늘 포함, 역순)
 * 규칙:
 * - 출석 기록이 있으면 무조건 카운트 (요일 무관, 재료화 테이블 유무 무관)
 * - 주말/공휴일에 미출석이면 스킵 (스트릭 안 끊김)
 * - 평일에 미출석이면서 "예정된 날"이면 break (결석 = 스트릭 종료)
 *   * 예정 판정: materialized / scheduled_patterns 요일 / cancelled 여부 종합
 * - 평일에 미출석이고 예정도 아니면 스킵 (쉬는 요일은 스트릭 안 끊김)
 * - 환자 등록일 이전 날짜는 더 이상 돌지 않음
 */
function calculateConsecutiveAttendance(
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
      dateStr,
      cursor.getDay(),
      scheduledMaterialized,
      cancelledMaterialized,
      patternDows,
      patientCreatedDate,
    );

    if (isScheduled) {
      break;
    }

    cursor = subDays(cursor, 1);
  }

  return count;
}

/**
 * 연속 진찰 일수 계산
 * 규칙:
 * - 주말/공휴일: 출석만 했어도 카운트 (진찰 의무 없음). 미출석이면 스킵.
 * - 평일 출석+진찰 → 카운트
 * - 평일 출석했으나 진찰 없음 → break (진찰 스트릭 종료)
 * - 평일 미출석 + 예정된 날 → break (결석으로 진찰 스트릭 종료)
 * - 평일 미출석 + 예정 아닌 날 → 스킵
 */
function calculateConsecutiveConsultation(
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

    // 평일
    if (isAttended) {
      if (!consultedDates.has(dateStr)) break;
      count++;
      cursor = subDays(cursor, 1);
      continue;
    }

    // 평일 미출석
    const isScheduled = isScheduledOnDate(
      dateStr,
      cursor.getDay(),
      scheduledMaterialized,
      cancelledMaterialized,
      patternDows,
      patientCreatedDate,
    );
    if (isScheduled) break;

    cursor = subDays(cursor, 1);
  }

  return count;
}

export async function getAttendanceBoard(
  supabase: SupabaseClient<Database>,
  params: GetAttendanceBoardParams,
): Promise<AttendanceBoardResponse> {
  const date = params.date || getTodayString();

  await ensureScheduleGenerated(supabase, date);

  // 스트릭 계산용 60일 전 날짜
  const streakStartDate = format(subDays(parseISO(date), 60), 'yyyy-MM-dd');

  const [
    { data: patients, error: patientsError },
    { data: attendances, error: attendancesError },
    { data: scheduled, error: scheduledError },
    { data: consultations, error: consultationsError },
    { data: roomMappings, error: roomMappingsError },
    allAttendances,
    allConsultations,
    allScheduled,
    allPatterns,
    holidayMap,
  ] = await Promise.all([
    supabase
      .from('patients')
      .select('id, name, display_name, gender, avatar_url, room_number, created_at')
      .eq('status', 'active'),
    supabase
      .from('attendances')
      .select('patient_id, checked_at')
      .eq('date', date),
    supabase
      .from('scheduled_attendances')
      .select('patient_id')
      .eq('date', date)
      .eq('is_cancelled', false),
    supabase
      .from('consultations')
      .select('patient_id')
      .eq('date', date),
    supabase
      .from('room_coordinator_mapping')
      .select('room_prefix, coordinator:staff!coordinator_id(name)')
      .eq('is_active', true)
      .returns<RoomMappingWithCoordinator[]>(),
    // 스트릭 계산용 과거 출석 데이터 (60일치라 1000행 서버캡을 넘어갈 수 있어 전체 페이지 fetch)
    fetchAllPaginated<{ patient_id: string; date: string }>(() =>
      supabase
        .from('attendances')
        .select('patient_id, date')
        .gte('date', streakStartDate)
        .lte('date', date)
        .order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; date: string }>(() =>
      supabase
        .from('consultations')
        .select('patient_id, date')
        .gte('date', streakStartDate)
        .lte('date', date)
        .order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; date: string; is_cancelled: boolean }>(() =>
      supabase
        .from('scheduled_attendances')
        .select('patient_id, date, is_cancelled')
        .gte('date', streakStartDate)
        .lte('date', date)
        .order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; day_of_week: number }>(() =>
      supabase
        .from('scheduled_patterns')
        .select('patient_id, day_of_week')
        .eq('is_active', true)
        .order('id'),
    ),
    getHolidayDatesMap(supabase, streakStartDate, date),
  ]);

  if (patientsError || attendancesError || scheduledError || consultationsError || roomMappingsError) {
    const errorMsg = [patientsError, attendancesError, scheduledError, consultationsError, roomMappingsError]
      .filter(Boolean)
      .map((e) => e?.message)
      .join(', ');
    throw new AttendanceBoardError(
      AttendanceBoardErrorCode.FETCH_FAILED,
      `출석 보드 데이터 조회 실패: ${errorMsg}`,
    );
  }

  // 오늘 출석 맵
  const attendanceMap = new Map<string, string>();
  for (const a of attendances ?? []) {
    attendanceMap.set(a.patient_id, a.checked_at);
  }

  const scheduledSet = new Set<string>(
    (scheduled ?? []).map((s) => s.patient_id),
  );

  const consultedSet = new Set<string>(
    (consultations ?? []).map((c) => c.patient_id),
  );

  // 스트릭 계산용 환자별 데이터 맵 구축
  const patientAttendanceDates = new Map<string, Set<string>>();
  const patientConsultationDates = new Map<string, Set<string>>();
  const patientScheduledDates = new Map<string, Set<string>>();
  const patientCancelledDates = new Map<string, Set<string>>();
  const patientPatternDows = new Map<string, Set<number>>();

  for (const a of allAttendances ?? []) {
    const set = patientAttendanceDates.get(a.patient_id) ?? new Set();
    set.add(a.date);
    patientAttendanceDates.set(a.patient_id, set);
  }

  for (const c of allConsultations ?? []) {
    const set = patientConsultationDates.get(c.patient_id) ?? new Set();
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

  // 코디네이터 맵
  const coordinatorMap = new Map<string, string>();
  for (const rm of roomMappings ?? []) {
    if (rm.coordinator?.name) {
      coordinatorMap.set(rm.room_prefix, rm.coordinator.name);
    }
  }

  // 호실별 그룹핑
  const roomGroupsMap = new Map<string, BoardPatient[]>();

  /** 상태 우선순위 (낮을수록 먼저 표시) */
  const STATUS_PRIORITY: Record<AttendanceStatus, number> = {
    attended_consulted: 0,
    attended: 1,
    absent: 2,
    not_scheduled: 3,
  };

  for (const patient of patients ?? []) {
    const roomPrefix = patient.room_number
      ? patient.room_number.toString().substring(0, 4)
      : 'unknown';

    const isScheduled = scheduledSet.has(patient.id);
    const isAttended = attendanceMap.has(patient.id);
    const isConsulted = consultedSet.has(patient.id);

    const status: AttendanceStatus =
      !isScheduled && !isAttended ? 'not_scheduled' :
      !isAttended ? 'absent' :
      isConsulted ? 'attended_consulted' : 'attended';

    const isNotScheduled = status === 'not_scheduled';

    const pScheduled = patientScheduledDates.get(patient.id) ?? new Set<string>();
    const pCancelled = patientCancelledDates.get(patient.id) ?? new Set<string>();
    const pAttended = patientAttendanceDates.get(patient.id) ?? new Set<string>();
    const pConsulted = patientConsultationDates.get(patient.id) ?? new Set<string>();
    const pPatternDows = patientPatternDows.get(patient.id) ?? new Set<number>();
    const patientCreatedDate = (patient.created_at ?? '').slice(0, 10);

    const attendanceStreak = isNotScheduled
      ? 0
      : calculateConsecutiveAttendance(pScheduled, pCancelled, pPatternDows, pAttended, patientCreatedDate, holidayMap, date);
    const consultationStreak = isNotScheduled
      ? 0
      : calculateConsecutiveConsultation(pScheduled, pCancelled, pPatternDows, pAttended, pConsulted, patientCreatedDate, holidayMap, date);

    const boardPatient: BoardPatient = {
      id: patient.id,
      name: patient.display_name || patient.name,
      display_name: patient.display_name,
      gender: (patient.gender as 'M' | 'F' | null) ?? null,
      avatar_url: patient.avatar_url ?? null,
      room_number: patient.room_number,
      status,
      is_attended: isAttended,
      attendance_time: attendanceMap.get(patient.id) ?? null,
      is_scheduled: isScheduled,
      is_consulted: isConsulted,
      has_task: false,
      task_completed: false,
      attendance_streak: attendanceStreak,
      consultation_streak: consultationStreak,
      streak_tier: getStreakTier(attendanceStreak),
    };

    const existing = roomGroupsMap.get(roomPrefix) ?? [];
    existing.push(boardPatient);
    roomGroupsMap.set(roomPrefix, existing);
  }

  const rooms: RoomGroup[] = [];
  let totalAttended = 0;
  let totalScheduled = 0;
  let totalConsulted = 0;
  let totalUnscheduledAttended = 0;
  let totalCount = 0;

  const sortedRoomPrefixes = Array.from(roomGroupsMap.keys()).sort();

  for (const roomPrefix of sortedRoomPrefixes) {
    const roomPatients = roomGroupsMap.get(roomPrefix) ?? [];

    // 상태 우선순위 정렬
    roomPatients.sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

    const attendedCount = roomPatients.filter((p) => p.is_attended).length;
    const scheduledCount = roomPatients.filter((p) => p.is_scheduled).length;
    const consultedCount = roomPatients.filter((p) => p.is_consulted).length;
    const unscheduledAttendedCount = roomPatients.filter((p) => p.is_attended && !p.is_scheduled).length;

    totalAttended += attendedCount;
    totalScheduled += scheduledCount;
    totalConsulted += consultedCount;
    totalUnscheduledAttended += unscheduledAttendedCount;
    totalCount += roomPatients.length;

    rooms.push({
      room_prefix: roomPrefix,
      coordinator_name: coordinatorMap.get(roomPrefix) ?? null,
      patients: roomPatients,
      attended_count: attendedCount,
      scheduled_count: scheduledCount,
      consulted_count: consultedCount,
      unscheduled_attended_count: unscheduledAttendedCount,
      total_count: roomPatients.length,
    });
  }

  return {
    date,
    rooms,
    total_attended: totalAttended,
    total_scheduled: totalScheduled,
    total_consulted: totalConsulted,
    total_unscheduled_attended: totalUnscheduledAttended,
    total_count: totalCount,
  };
}

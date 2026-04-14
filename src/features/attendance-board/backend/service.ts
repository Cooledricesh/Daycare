import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
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
 * 연속 출석 일수 계산 (오늘 포함, 역순)
 * - 주말/공휴일: 예정+출석이면 카운트, 예정이 아니면 스킵 (스트릭 안 끊김)
 */
function calculateConsecutiveAttendance(
  scheduledDates: Set<string>,
  attendedDates: Set<string>,
  holidayMap: Map<string, string>,
  endDate: string,
): number {
  let count = 0;
  let cursor = parseISO(endDate);

  for (let i = 0; i < 365; i++) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    const isHolidayOrWeekend = isWeekend(dateStr) || holidayMap.has(dateStr);
    const isScheduled = scheduledDates.has(dateStr);
    const isAttended = attendedDates.has(dateStr);

    if (isHolidayOrWeekend) {
      if (isScheduled && isAttended) {
        // 주말/공휴일이지만 예정+출석 → 카운트
        count++;
      }
      // 예정 아니거나 미출석 → 스킵 (스트릭 안 끊김)
      cursor = subDays(cursor, 1);
      continue;
    }

    if (!isScheduled) {
      cursor = subDays(cursor, 1);
      continue;
    }

    if (!isAttended) {
      break;
    }

    count++;
    cursor = subDays(cursor, 1);
  }

  return count;
}

/**
 * 연속 진찰 일수 계산
 * - 주말/공휴일: 진찰 일정이 없으므로 출석만 했으면 스트릭 유지+카운트
 * - 평일: 출석+진찰 모두 필요
 */
function calculateConsecutiveConsultation(
  scheduledDates: Set<string>,
  attendedDates: Set<string>,
  consultedDates: Set<string>,
  holidayMap: Map<string, string>,
  endDate: string,
): number {
  let count = 0;
  let cursor = parseISO(endDate);

  for (let i = 0; i < 365; i++) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    const isHolidayOrWeekend = isWeekend(dateStr) || holidayMap.has(dateStr);
    const isScheduled = scheduledDates.has(dateStr);
    const isAttended = attendedDates.has(dateStr);

    if (isHolidayOrWeekend) {
      if (isScheduled && isAttended) {
        // 주말/공휴일에 예정+출석이면 진찰 없어도 스트릭 카운트
        count++;
      }
      // 아니면 스킵 (스트릭 안 끊김)
      cursor = subDays(cursor, 1);
      continue;
    }

    if (!isScheduled) {
      cursor = subDays(cursor, 1);
      continue;
    }

    // 평일: 출석+진찰 모두 필요
    if (!isAttended || !consultedDates.has(dateStr)) {
      break;
    }

    count++;
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
    { data: allAttendances },
    { data: allConsultations },
    { data: allScheduled },
    holidayMap,
  ] = await Promise.all([
    supabase
      .from('patients')
      .select('id, name, display_name, gender, avatar_url, room_number')
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
    // 스트릭 계산용 과거 출석 데이터
    supabase
      .from('attendances')
      .select('patient_id, date')
      .gte('date', streakStartDate)
      .lte('date', date),
    supabase
      .from('consultations')
      .select('patient_id, date')
      .gte('date', streakStartDate)
      .lte('date', date),
    supabase
      .from('scheduled_attendances')
      .select('patient_id, date')
      .eq('is_cancelled', false)
      .gte('date', streakStartDate)
      .lte('date', date),
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
    const set = patientScheduledDates.get(s.patient_id) ?? new Set();
    set.add(s.date);
    patientScheduledDates.set(s.patient_id, set);
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
    const pAttended = patientAttendanceDates.get(patient.id) ?? new Set<string>();
    const pConsulted = patientConsultationDates.get(patient.id) ?? new Set<string>();

    const attendanceStreak = isNotScheduled ? 0 : calculateConsecutiveAttendance(pScheduled, pAttended, holidayMap, date);
    const consultationStreak = isNotScheduled ? 0 : calculateConsecutiveConsultation(pScheduled, pAttended, pConsulted, holidayMap, date);

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

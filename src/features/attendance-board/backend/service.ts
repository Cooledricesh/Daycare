import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  GetAttendanceBoardParams,
  BoardPatient,
  RoomGroup,
  AttendanceBoardResponse,
  AttendanceStatus,
} from './schema';
import { AttendanceBoardError, AttendanceBoardErrorCode } from './error';
import { getTodayString } from '@/lib/date';
import { ensureScheduleGenerated } from '@/server/services/schedule';
import { getStreaksMap, type PatientStreaks } from '@/features/shared/backend/streak';
import { getStreakTier } from '@/features/shared/lib/streak-tier';

interface RoomMappingWithCoordinator {
  room_prefix: string;
  coordinator: { name: string } | null;
}

export async function getAttendanceBoard(
  supabase: SupabaseClient<Database>,
  params: GetAttendanceBoardParams,
): Promise<AttendanceBoardResponse> {
  const date = params.date || getTodayString();

  await ensureScheduleGenerated(supabase, date);

  const [
    { data: patients, error: patientsError },
    { data: attendances, error: attendancesError },
    { data: scheduled, error: scheduledError },
    { data: consultations, error: consultationsError },
    { data: roomMappings, error: roomMappingsError },
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
      .from('room_coordinator_assignments')
      .select('room_prefix, coordinator:staff!coordinator_id(name)')
      .eq('role', 'primary')
      .eq('is_active', true)
      .returns<RoomMappingWithCoordinator[]>(),
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

  // 전 활성 환자 스트릭 맵 (60일 윈도우 + 자동 휴원 감지, 공유 모듈)
  const streaksMap: Map<string, PatientStreaks> = await getStreaksMap(
    supabase,
    date,
    (patients ?? []).map((p) => ({ id: p.id, created_at: p.created_at })),
  );

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

    const raw = streaksMap.get(patient.id) ?? {
      attendance_streak: 0,
      consultation_streak: 0,
      streak_tier: 'none' as const,
    };
    const attendanceStreak = isNotScheduled ? 0 : raw.attendance_streak;
    const consultationStreak = isNotScheduled ? 0 : raw.consultation_streak;

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

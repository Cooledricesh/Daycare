import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  GetMyPatientsParams,
  GetPatientDetailParams,
  CompleteTaskRequest,
  CreateMessageRequest,
  UpdateSchedulePatternRequest,
  GetMessagesParams,
  BatchAttendanceRequest,
  BatchCancelAttendanceRequest,
  BatchConsultationRequest,
  BatchCancelConsultationRequest,
  PatientSummary,
  PatientDetail,
  TaskCompletion,
  Message,
  MyPatientSchedulePattern,
  MessageItem,
} from './schema';
import { StaffError, StaffErrorCode } from './error';
import {
  completeTask as completeTaskShared,
} from '@/server/services/task';
import {
  createMessage as createMessageShared,
  deleteMessage as deleteMessageShared,
  updateMessage as updateMessageShared,
} from '@/server/services/message';
import { getMonthsAgoString, getTodayString } from '@/lib/date';
import { getPatientDayDetail } from '@/server/services/patient-detail';
import { ensureScheduleGenerated } from '@/server/services/schedule';

type PatientRow = Database['public']['Tables']['patients']['Row'];
type AttendanceRow = Database['public']['Tables']['attendances']['Row'];
type ConsultationRow = Database['public']['Tables']['consultations']['Row'];
type TaskCompletionRow = Database['public']['Tables']['task_completions']['Row'];
type MessageRow = Database['public']['Tables']['messages']['Row'];
type ScheduledAttendanceRow = Database['public']['Tables']['scheduled_attendances']['Row'];
type ScheduledPatternRow = Database['public']['Tables']['scheduled_patterns']['Row'];
type VitalsRow = Database['public']['Tables']['vitals']['Row'];

/** consultations with nested task_completions join */
interface ConsultationWithTasks {
  patient_id: string;
  id: string;
  has_task: boolean;
  task_content: string | null;
  task_target: string | null;
  checked_by_coordinator: boolean;
  task_completions: Pick<TaskCompletionRow, 'is_completed'>[];
}

/** consultations with nested task_completions (detail view) */
interface ConsultationDetailResult {
  id: string;
  note: string | null;
  has_task: boolean;
  task_content: string | null;
  task_target: string | null;
  task_completions: Pick<TaskCompletionRow, 'id' | 'is_completed' | 'completed_at' | 'memo' | 'role'>[];
}

/** consultations with doctor join for recent history */
interface RecentConsultationResult {
  date: string;
  note: string | null;
  staff: { name: string } | null;
}

/** messages with patients join */
interface MessageWithPatient {
  id: string;
  patient_id: string;
  date: string;
  content: string;
  is_read: boolean;
  created_at: string;
  patients: { name: string };
}

/**
 * 담당 환자 목록 조회
 */
export async function getMyPatients(
  supabase: SupabaseClient<Database>,
  coordinatorId: string,
  params: GetMyPatientsParams,
): Promise<PatientSummary[]> {
  const date = params.date || getTodayString();

  const showAll = params.show_all === 'true';

  // 오늘 스케줄이 없으면 패턴에서 자동 생성
  await ensureScheduleGenerated(supabase, date);

  // show_all=true이면 RPC 스킵하고 직접 전체 환자 조회
  if (!showAll) {
    const { data, error } = await (supabase.rpc as (fn: string, params: Record<string, string>) => ReturnType<typeof supabase.rpc>)(
      'get_coordinator_patients',
      { p_coordinator_id: coordinatorId, p_date: date },
    );

    if (!error && data) {
      const rpcPatients = data as PatientSummary[];
      const rpcPatientIds = rpcPatients.map((p) => p.id);

      if (rpcPatientIds.length === 0) {
        return rpcPatients;
      }

      // RPC 결과에 is_scheduled, is_coordinator_checked 정보를 추가
      const [
        { data: scheduledAttendances },
        { data: rpcConsultations },
      ] = await Promise.all([
        supabase.from('scheduled_attendances')
          .select('patient_id')
          .eq('date', date)
          .eq('is_cancelled', false)
          .in('patient_id', rpcPatientIds),
        supabase.from('consultations')
          .select('patient_id, checked_by_coordinator')
          .eq('date', date)
          .in('patient_id', rpcPatientIds),
      ]);

      const scheduledSet = new Set<string>(
        (scheduledAttendances || []).map((s) => s.patient_id),
      );
      const coordinatorCheckedSet = new Set<string>(
        (rpcConsultations || [])
          .filter((c) => c.checked_by_coordinator)
          .map((c) => c.patient_id),
      );

      return rpcPatients.map((p) => ({
        ...p,
        is_scheduled: scheduledSet.has(p.id),
        is_coordinator_checked: coordinatorCheckedSet.has(p.id),
      }));
    }
  }

  {
    // 환자 목록 조회: show_all이면 전체, 아니면 담당만
    let patientsQuery = supabase
      .from('patients')
      .select('id, name, display_name, avatar_url, gender')
      .eq('status', 'active');

    if (!showAll) {
      patientsQuery = patientsQuery.eq('coordinator_id', coordinatorId);
    }

    const { data: patients, error: patientsError } = await patientsQuery;

    if (patientsError) {
      throw new StaffError(
        StaffErrorCode.INVALID_REQUEST,
        `환자 목록 조회에 실패했습니다: ${patientsError.message}`,
      );
    }

    // 각 환자에 대해 출석, 진찰, 메시지 정보 조회
    const patientIds = (patients || []).map((p) => p.id);

    if (patientIds.length === 0) {
      return [];
    }

    // 출석, 진찰, 메시지, 출석예정을 병렬로 조회
    const [
      { data: attendances },
      { data: consultations },
      { data: messages },
      { data: scheduledAttendances },
    ] = await Promise.all([
      supabase.from('attendances')
        .select('patient_id, checked_at')
        .in('patient_id', patientIds)
        .eq('date', date),
      supabase.from('consultations')
        .select('patient_id, id, has_task, task_content, task_target, checked_by_coordinator, task_completions(is_completed)')
        .in('patient_id', patientIds)
        .eq('date', date)
        .returns<ConsultationWithTasks[]>(),
      supabase.from('messages')
        .select('patient_id, id, is_read')
        .in('patient_id', patientIds)
        .eq('date', date),
      supabase.from('scheduled_attendances')
        .select('patient_id')
        .eq('date', date)
        .eq('is_cancelled', false)
        .in('patient_id', patientIds),
    ]);

    // 데이터를 Map으로 변환
    const attendanceMap = new Map(
      (attendances || []).map((a) => [a.patient_id, a]),
    );
    const consultationMap = new Map(
      (consultations || []).map((c) => [c.patient_id, c]),
    );
    const messageMap = new Map<string, Pick<MessageRow, 'patient_id' | 'id' | 'is_read'>[]>();
    (messages || []).forEach((m) => {
      if (!messageMap.has(m.patient_id)) {
        messageMap.set(m.patient_id, []);
      }
      messageMap.get(m.patient_id)!.push(m);
    });
    const scheduledSet = new Set<string>(
      (scheduledAttendances || []).map((s) => s.patient_id),
    );

    // 데이터 변환 (Map에서 조회)
    return (patients || []).map((p) => {
      const attendance = attendanceMap.get(p.id);
      const consultation = consultationMap.get(p.id);
      const taskCompletions = consultation?.task_completions || [];
      const patientMessages = messageMap.get(p.id) || [];

      return {
        id: p.id,
        name: p.name,
        display_name: p.display_name ?? null,
        avatar_url: (p as unknown as { avatar_url: string | null }).avatar_url ?? null,
        gender: p.gender || null,
        is_attended: !!attendance,
        attendance_time: attendance?.checked_at || null,
        is_scheduled: scheduledSet.has(p.id),
        is_consulted: !!consultation,
        is_coordinator_checked: !!consultation?.checked_by_coordinator,
        has_task: !!consultation?.has_task,
        task_content: consultation?.task_content || null,
        task_completed:
          taskCompletions.length > 0
            ? taskCompletions.some((tc) => tc.is_completed)
            : false,
        unread_message_count: patientMessages.filter((m) => !m.is_read).length,
      };
    });
  }
}

/**
 * 환자 상세 조회
 */
export async function getPatientDetail(
  supabase: SupabaseClient<Database>,
  coordinatorId: string,
  userRole: string,
  params: GetPatientDetailParams,
): Promise<PatientDetail> {
  const date = params.date || getTodayString();

  // 최근 진찰 기록 조회를 위한 날짜 (한국 시간 기준)
  const oneMonthAgoStr = getMonthsAgoString(1);

  // 모든 쿼리를 병렬로 실행 (patient_id는 이미 알고 있으므로)
  const [
    { data: patient, error: patientError },
    dayDetail,
    { data: recentConsultations },
  ] = await Promise.all([
    supabase.from('patients')
      .select('id, name, display_name, avatar_url, gender, coordinator_id')
      .eq('id', params.patient_id)
      .single(),
    getPatientDayDetail(supabase, params.patient_id, date),
    supabase.from('consultations')
      .select('date, note, staff:doctor_id(name)')
      .eq('patient_id', params.patient_id)
      .gte('date', oneMonthAgoStr)
      .neq('date', date)
      .order('date', { ascending: false })
      .limit(10)
      .returns<RecentConsultationResult[]>(),
  ]);

  const { attendance, consultation, vitals } = dayDetail;

  if (patientError || !patient) {
    throw new StaffError(
      StaffErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  // task_completions에서 완료된 항목이 하나라도 있는지 확인
  const anyTaskCompletion =
    consultation?.task_completions?.find(
      (tc) => tc.is_completed,
    ) || null;

  return {
    id: patient.id,
    name: patient.name,
    display_name: patient.display_name ?? null,
    avatar_url: (patient as unknown as { avatar_url: string | null }).avatar_url ?? null,
    gender: patient.gender,
    attendance: {
      is_attended: !!attendance,
      checked_at: attendance?.checked_at || null,
    },
    consultation: {
      is_consulted: !!consultation,
      note: consultation?.note || null,
      has_task: !!consultation?.has_task,
      task_content: consultation?.task_content || null,
      task_target: consultation?.task_target || null,
      consultation_id: consultation?.id || null,
      task_completion_id: anyTaskCompletion?.id || null,
      is_task_completed: anyTaskCompletion?.is_completed || false,
    },
    vitals: vitals || null,
    recent_consultations: (recentConsultations || []).map((rc) => ({
      date: rc.date,
      note: rc.note,
      doctor_name: rc.staff?.name || '알 수 없음',
    })),
  };
}

/**
 * 지시사항 처리 완료
 */
export async function completeTask(
  supabase: SupabaseClient<Database>,
  staffId: string,
  params: CompleteTaskRequest,
): Promise<TaskCompletion> {
  return completeTaskShared(supabase, staffId, 'coordinator', {
    consultation_id: params.consultation_id,
    memo: params.memo,
    mapError: (err) => {
      const codeMap: Record<string, StaffErrorCode> = {
        TASK_NOT_FOUND: StaffErrorCode.TASK_NOT_FOUND,
        TASK_ALREADY_COMPLETED: StaffErrorCode.TASK_ALREADY_COMPLETED,
        TASK_UPDATE_FAILED: StaffErrorCode.INVALID_REQUEST,
      };
      return new StaffError(codeMap[err.code] ?? StaffErrorCode.INVALID_REQUEST, err.message);
    },
  });
}

/**
 * 전달사항 작성
 */
export async function createMessage(
  supabase: SupabaseClient<Database>,
  staffId: string,
  params: CreateMessageRequest,
): Promise<Message> {
  return createMessageShared(supabase, staffId, 'coordinator', {
    patient_id: params.patient_id,
    date: params.date,
    content: params.content,
  }, {
    mapError: (err) => new StaffError(StaffErrorCode.MESSAGE_SAVE_FAILED, err.message),
  });
}

/**
 * 전달사항 삭제
 */
export async function deleteMessage(
  supabase: SupabaseClient<Database>,
  staffId: string,
  messageId: string,
  isAdmin = false,
): Promise<void> {
  await deleteMessageShared(supabase, messageId, staffId, isAdmin, {
    mapError: (err) => new StaffError(StaffErrorCode.MESSAGE_DELETE_FAILED, err.message),
  });
}

/**
 * 전달사항 수정
 */
export async function updateMessage(
  supabase: SupabaseClient<Database>,
  staffId: string,
  messageId: string,
  content: string,
  isAdmin = false,
): Promise<void> {
  await updateMessageShared(supabase, messageId, staffId, isAdmin, { content }, {
    mapError: (err) => new StaffError(StaffErrorCode.MESSAGE_UPDATE_FAILED, err.message),
  });
}

/**
 * 담당 환자 출석 패턴 목록 조회
 */
export async function getMyPatientsSchedulePatterns(
  supabase: SupabaseClient<Database>,
  coordinatorId: string,
): Promise<MyPatientSchedulePattern[]> {
  // 담당 환자 목록 조회
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, name')
    .eq('coordinator_id', coordinatorId)
    .eq('status', 'active')
    .order('name');

  if (patientsError) {
    throw new StaffError(
      StaffErrorCode.INVALID_REQUEST,
      `환자 목록 조회에 실패했습니다: ${patientsError.message}`,
    );
  }

  const patientIds = (patients || []).map((p) => p.id);

  if (patientIds.length === 0) {
    return [];
  }

  // 스케줄 패턴 조회
  const { data: patterns } = await supabase
    .from('scheduled_patterns')
    .select('patient_id, day_of_week')
    .in('patient_id', patientIds)
    .eq('is_active', true);

  const patternMap = new Map<string, number[]>();
  (patterns || []).forEach((p) => {
    if (!patternMap.has(p.patient_id)) {
      patternMap.set(p.patient_id, []);
    }
    patternMap.get(p.patient_id)!.push(p.day_of_week);
  });

  return (patients || []).map((p) => ({
    patient_id: p.id,
    patient_name: p.name,
    schedule_days: (patternMap.get(p.id) || []).sort((a, b) => a - b),
  }));
}

/**
 * 담당 환자 출석 패턴 수정
 */
export async function updateMyPatientSchedulePattern(
  supabase: SupabaseClient<Database>,
  coordinatorId: string,
  patientId: string,
  request: UpdateSchedulePatternRequest,
): Promise<{ success: boolean }> {
  // 담당 환자인지 확인
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, coordinator_id')
    .eq('id', patientId)
    .single();

  if (patientError || !patient) {
    throw new StaffError(
      StaffErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  if (patient.coordinator_id !== coordinatorId) {
    throw new StaffError(
      StaffErrorCode.UNAUTHORIZED,
      '담당 환자가 아닙니다',
    );
  }

  // 기존 패턴 삭제
  await supabase
    .from('scheduled_patterns')
    .delete()
    .eq('patient_id', patientId);

  // 새 패턴 생성
  if (request.schedule_days.length > 0) {
    const patternsToInsert = request.schedule_days.map((day) => ({
      patient_id: patientId,
      day_of_week: day,
      is_active: true,
    }));

    const { error: insertError } = await supabase
      .from('scheduled_patterns')
      .insert(patternsToInsert);

    if (insertError) {
      throw new StaffError(
        StaffErrorCode.INVALID_REQUEST,
        `스케줄 패턴 수정에 실패했습니다: ${insertError.message}`,
      );
    }
  }

  return { success: true };
}

/**
 * 본인이 작성한 전달사항 목록 조회
 */
export async function getMyMessages(
  supabase: SupabaseClient<Database>,
  authorId: string,
  params: GetMessagesParams,
): Promise<MessageItem[]> {
  const date = params.date || getTodayString();

  // 해당 날짜의 본인이 작성한 전달사항 조회
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('id, patient_id, date, content, is_read, created_at, patients!inner(name)')
    .eq('author_id', authorId)
    .eq('date', date)
    .order('created_at', { ascending: false })
    .returns<MessageWithPatient[]>();

  if (messagesError) {
    throw new StaffError(
      StaffErrorCode.INVALID_REQUEST,
      `전달사항 조회에 실패했습니다: ${messagesError.message}`,
    );
  }

  return (messages || []).map((m) => ({
    id: m.id,
    patient_id: m.patient_id,
    patient_name: m.patients?.name || '알 수 없음',
    date: m.date,
    content: m.content,
    is_read: m.is_read,
    created_at: m.created_at,
  }));
}

/**
 * 일괄 출석 체크
 */
export async function batchCreateAttendance(
  supabase: SupabaseClient<Database>,
  params: BatchAttendanceRequest,
): Promise<{ created: number; skipped: number }> {
  const date = params.date || getTodayString();
  const patientIds = params.patient_ids;

  // 이미 출석한 환자 조회
  const { data: existing } = await supabase
    .from('attendances')
    .select('patient_id')
    .in('patient_id', patientIds)
    .eq('date', date);

  const existingSet = new Set<string>(
    (existing || []).map((a) => a.patient_id),
  );

  // 미출석 환자만 필터
  const toCreate = patientIds.filter((id) => !existingSet.has(id));

  if (toCreate.length === 0) {
    return { created: 0, skipped: patientIds.length };
  }

  const records = toCreate.map((patient_id) => ({
    patient_id,
    date,
    checked_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('attendances')
    .insert(records);

  if (error) {
    throw new StaffError(
      StaffErrorCode.INVALID_REQUEST,
      `출석 체크에 실패했습니다: ${error.message}`,
    );
  }

  return { created: toCreate.length, skipped: existingSet.size };
}

/**
 * 일괄 출석 취소
 * 의사 진찰 기록이 있는 환자는 출석 취소 불가
 * 코디 체크 진찰(checked_by_coordinator=true)은 출석 취소 시 함께 삭제
 */
export async function batchCancelAttendance(
  supabase: SupabaseClient<Database>,
  params: BatchCancelAttendanceRequest,
): Promise<{ cancelled: number; skippedConsulted: number; clearedCoordinatorConsultations: number }> {
  const date = params.date || getTodayString();
  const patientIds = params.patient_ids;

  // 해당 날짜에 진찰 기록이 있는 환자 조회 (코디 체크 여부 포함)
  const { data: consulted } = await supabase
    .from('consultations')
    .select('patient_id, checked_by_coordinator')
    .in('patient_id', patientIds)
    .eq('date', date);

  // 의사 진찰은 출석 취소 불가, 코디 체크 진찰은 함께 삭제
  const doctorConsultedSet = new Set<string>();
  const coordinatorCheckedIds: string[] = [];

  (consulted || []).forEach((c) => {
    if (c.checked_by_coordinator) {
      coordinatorCheckedIds.push(c.patient_id);
    } else {
      doctorConsultedSet.add(c.patient_id);
    }
  });

  const cancellableIds = patientIds.filter((id) => !doctorConsultedSet.has(id));
  const skippedConsulted = patientIds.filter((id) => doctorConsultedSet.has(id)).length;

  if (cancellableIds.length === 0) {
    return { cancelled: 0, skippedConsulted, clearedCoordinatorConsultations: 0 };
  }

  // 코디 체크 진찰 중 출석 취소 대상에 포함된 것들 삭제
  const coordToDelete = coordinatorCheckedIds.filter((id) => cancellableIds.includes(id));
  let clearedCoordinatorConsultations = 0;

  if (coordToDelete.length > 0) {
    const { data: deletedConsultations } = await supabase
      .from('consultations')
      .delete()
      .in('patient_id', coordToDelete)
      .eq('date', date)
      .eq('checked_by_coordinator', true)
      .select('patient_id');
    clearedCoordinatorConsultations = (deletedConsultations || []).length;
  }

  const { data: deleted, error } = await supabase
    .from('attendances')
    .delete()
    .in('patient_id', cancellableIds)
    .eq('date', date)
    .select('patient_id');

  if (error) {
    throw new StaffError(
      StaffErrorCode.INVALID_REQUEST,
      `출석 취소에 실패했습니다: ${error.message}`,
    );
  }

  return { cancelled: (deleted || []).length, skippedConsulted, clearedCoordinatorConsultations };
}

/**
 * 일괄 진찰 체크 (코디네이터)
 * 출석 완료 + 미진찰 + 주치의 지정 환자만 진찰 레코드 생성
 */
export async function batchCreateConsultation(
  supabase: SupabaseClient<Database>,
  params: BatchConsultationRequest,
): Promise<{ created: number; skippedAlreadyConsulted: number; skippedNotAttended: number; skippedNoDoctor: number }> {
  const date = params.date || getTodayString();
  const patientIds = params.patient_ids;

  // 환자 정보 조회 (doctor_id 포함)
  const [
    { data: patients },
    { data: existingConsultations },
    { data: attendances },
  ] = await Promise.all([
    supabase.from('patients')
      .select('id, doctor_id')
      .in('id', patientIds),
    supabase.from('consultations')
      .select('patient_id')
      .in('patient_id', patientIds)
      .eq('date', date),
    supabase.from('attendances')
      .select('patient_id')
      .in('patient_id', patientIds)
      .eq('date', date),
  ]);

  const consultedSet = new Set<string>(
    (existingConsultations || []).map((c) => c.patient_id),
  );
  const attendedSet = new Set<string>(
    (attendances || []).map((a) => a.patient_id),
  );
  const patientMap = new Map(
    (patients || []).map((p) => [p.id, p]),
  );

  let skippedAlreadyConsulted = 0;
  let skippedNotAttended = 0;
  let skippedNoDoctor = 0;

  const toCreate: { patient_id: string; doctor_id: string; date: string }[] = [];

  for (const pid of patientIds) {
    if (consultedSet.has(pid)) {
      skippedAlreadyConsulted++;
      continue;
    }
    if (!attendedSet.has(pid)) {
      skippedNotAttended++;
      continue;
    }
    const patient = patientMap.get(pid);
    if (!patient?.doctor_id) {
      skippedNoDoctor++;
      continue;
    }
    toCreate.push({ patient_id: pid, doctor_id: patient.doctor_id, date });
  }

  if (toCreate.length === 0) {
    return { created: 0, skippedAlreadyConsulted, skippedNotAttended, skippedNoDoctor };
  }

  const records = toCreate.map((item) => ({
    patient_id: item.patient_id,
    doctor_id: item.doctor_id,
    date: item.date,
    note: null,
    has_task: false,
    checked_by_coordinator: true,
  }));

  const { error } = await supabase
    .from('consultations')
    .insert(records);

  if (error) {
    throw new StaffError(
      StaffErrorCode.INVALID_REQUEST,
      `진찰 체크에 실패했습니다: ${error.message}`,
    );
  }

  return { created: toCreate.length, skippedAlreadyConsulted, skippedNotAttended, skippedNoDoctor };
}

/**
 * 일괄 진찰 취소 (코디네이터)
 * checked_by_coordinator=true인 레코드만 삭제
 */
export async function batchCancelConsultation(
  supabase: SupabaseClient<Database>,
  params: BatchCancelConsultationRequest,
): Promise<{ cancelled: number; skippedDoctorConsulted: number }> {
  const date = params.date || getTodayString();
  const patientIds = params.patient_ids;

  // checked_by_coordinator 상태 조회
  const { data: consultations } = await supabase
    .from('consultations')
    .select('patient_id, checked_by_coordinator')
    .in('patient_id', patientIds)
    .eq('date', date);

  const coordinatorCheckedIds: string[] = [];
  let skippedDoctorConsulted = 0;

  (consultations || []).forEach((c) => {
    if (c.checked_by_coordinator) {
      coordinatorCheckedIds.push(c.patient_id);
    } else {
      skippedDoctorConsulted++;
    }
  });

  if (coordinatorCheckedIds.length === 0) {
    return { cancelled: 0, skippedDoctorConsulted };
  }

  const { data: deleted, error } = await supabase
    .from('consultations')
    .delete()
    .in('patient_id', coordinatorCheckedIds)
    .eq('date', date)
    .eq('checked_by_coordinator', true)
    .select('patient_id');

  if (error) {
    throw new StaffError(
      StaffErrorCode.INVALID_REQUEST,
      `진찰 취소에 실패했습니다: ${error.message}`,
    );
  }

  return { cancelled: (deleted || []).length, skippedDoctorConsulted };
}

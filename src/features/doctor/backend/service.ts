import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TaskTarget, Gender } from '@/lib/supabase/types';
import type {
  GetTasksParams,
  GetPatientHistoryParams,
  GetMessagesParams,
  MarkMessageReadRequest,
  GetWaitingPatientsParams,
  CreateConsultationRequest,
  GetPatientMessagesParams,
  TaskItem,
  PatientHistory,
  DoctorMessage,
  WaitingPatient,
  CreatedConsultation,
  PatientMessage,
} from './schema';
import { DoctorError, DoctorErrorCode } from './error';
import { getTodayString, getMonthsAgoString } from '@/lib/date';
import { ensureScheduleGenerated } from '@/server/services/schedule';

type ConsultationsRow = Database['public']['Tables']['consultations']['Row'];
type TaskCompletionsRow = Database['public']['Tables']['task_completions']['Row'];
type AttendancesRow = Database['public']['Tables']['attendances']['Row'];
type MessagesRow = Database['public']['Tables']['messages']['Row'];
type PatientsRow = Database['public']['Tables']['patients']['Row'];
type TaskCompletionsInsert = Database['public']['Tables']['task_completions']['Insert'];

/** consultations + patients join (getTasks) */
interface ConsultationWithPatient {
  id: string;
  date: string;
  patient_id: string;
  task_content: string | null;
  task_target: TaskTarget | null;
  created_at: string;
  patients: {
    id: string;
    name: string;
    room_number: string | null;
    coordinator: { name: string } | null;
    coordinator_id: string | null;
  } | null;
}

/** task_completions select result */
interface TaskCompletionResult {
  consultation_id: string;
  role: 'coordinator' | 'nurse';
  is_completed: boolean;
  completed_at: string | null;
}

/** patients join (getPatientHistory) */
interface PatientWithJoins {
  id: string;
  name: string;
  gender: Gender | null;
  birth_date: string | null;
  room_number: string | null;
  coordinator: { name: string } | null;
  doctor: { name: string } | null;
}

/** consultations join (getPatientHistory) */
interface ConsultationWithDoctor {
  id: string;
  date: string;
  note: string | null;
  has_task: boolean;
  task_content: string | null;
  task_target: TaskTarget | null;
  created_at: string;
  doctor: { name: string } | null;
}

/** messages join (getPatientHistory / getMessages) */
interface MessageWithAuthor {
  id: string;
  date: string;
  author_id: string;
  content: string;
  is_read: boolean;
  author_role: 'coordinator' | 'nurse';
  created_at: string;
  author: { name: string } | null;
}

/** vitals select result */
interface VitalsResult {
  date: string;
  systolic: number | null;
  diastolic: number | null;
  blood_sugar: number | null;
}

/** messages join (getMessages) */
interface MessageWithPatient {
  id: string;
  patient_id: string;
  date: string;
  content: string;
  is_read: boolean;
  author_role: 'coordinator' | 'nurse';
  created_at: string;
  patients: { name: string; coordinator_id: string | null } | null;
  author: { name: string } | null;
}

/** patients join (getWaitingPatients) */
interface PatientWithCoordinator {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  gender: Gender | null;
  birth_date: string | null;
  room_number: string | null;
  coordinator: { name: string } | null;
}

/** attendances select result */
interface AttendanceResult {
  patient_id: string;
  checked_at: string;
}

/** consultations with task_completions join */
interface ConsultationWithTaskCompletions {
  patient_id: string;
  has_task: boolean;
  task_completions: { is_completed: boolean }[];
}

/** messages patient_id only */
interface MessagePatientId {
  patient_id: string;
}

/** vitals for waiting patients */
interface VitalsForPatient {
  patient_id: string;
  systolic: number | null;
  diastolic: number | null;
  blood_sugar: number | null;
}

/** scheduled_attendances select result */
interface ScheduledAttendanceResult {
  patient_id: string;
}

/** consultations for task status */
interface ConsultationForTask {
  id: string;
  patient_id: string;
  task_target: TaskTarget | null;
}

/** task completion status */
interface TaskCompletionStatus {
  consultation_id: string;
  role: 'coordinator' | 'nurse';
  is_completed: boolean;
}

/** patients select for createConsultation */
interface PatientIdWithCoordinator {
  id: string;
  coordinator_id: string | null;
}

/** patient messages join */
interface PatientMessageWithAuthor {
  id: string;
  content: string;
  is_read: boolean;
  author_role: 'coordinator' | 'nurse';
  created_at: string;
  author: { name: string } | null;
}

/**
 * 지시사항 목록 조회 (날짜 범위 지원)
 */
export async function getTasks(
  supabase: SupabaseClient<Database>,
  doctorId: string,
  params: GetTasksParams,
  options?: { coordinatorId?: string },
): Promise<TaskItem[]> {
  // 진찰 기록 중 has_task가 true인 것만 조회
  let query = supabase
    .from('consultations')
    .select(`
      id,
      date,
      patient_id,
      task_content,
      task_target,
      created_at,
      patients!inner(
        id,
        name,
        room_number,
        coordinator:coordinator_id(name),
        coordinator_id
      )
    `)
    .eq('has_task', true)
    .order('created_at', { ascending: false });

  // 코디네이터인 경우 담당 환자만 필터
  if (options?.coordinatorId) {
    query = query.eq('patients.coordinator_id', options.coordinatorId);
  }

  // date range 우선, 없으면 단일 date
  if (params.start_date && params.end_date) {
    query = query.gte('date', params.start_date).lte('date', params.end_date);
  } else {
    query = query.eq('date', params.date || getTodayString());
  }

  const { data: rawConsultations, error: consultationsError } = await query;
  const consultations = rawConsultations as ConsultationWithPatient[] | null;

  if (consultationsError) {
    throw new DoctorError(
      DoctorErrorCode.INVALID_REQUEST,
      `지시사항 조회에 실패했습니다: ${consultationsError.message}`,
    );
  }

  if (!consultations || consultations.length === 0) {
    return [];
  }

  // 진찰 ID 목록
  const consultationIds = consultations.map((c) => c.id);

  // task_completions 조회
  const { data: completions } = await supabase
    .from('task_completions')
    .select('consultation_id, role, is_completed, completed_at')
    .in('consultation_id', consultationIds)
    .returns<TaskCompletionResult[]>();

  // completion Map 생성
  const completionMap = new Map<string, TaskCompletionResult[]>();
  (completions || []).forEach((tc) => {
    if (!completionMap.has(tc.consultation_id)) {
      completionMap.set(tc.consultation_id, []);
    }
    completionMap.get(tc.consultation_id)!.push(tc);
  });

  // 결과 변환
  const tasks: TaskItem[] = consultations.map((c) => {
    const taskCompletions = completionMap.get(c.id) || [];
    const coordinatorCompletion = taskCompletions.find((tc) => tc.role === 'coordinator');
    const nurseCompletion = taskCompletions.find((tc) => tc.role === 'nurse');

    return {
      consultation_id: c.id,
      patient_id: c.patient_id,
      patient_name: c.patients?.name || '알 수 없음',
      room_number: c.patients?.room_number || null,
      coordinator_name: c.patients?.coordinator?.name || null,
      date: c.date,
      task_content: c.task_content || '',
      task_target: c.task_target,
      created_at: c.created_at,
      coordinator_completed: coordinatorCompletion?.is_completed || false,
      coordinator_completed_at: coordinatorCompletion?.completed_at || null,
      nurse_completed: nurseCompletion?.is_completed || false,
      nurse_completed_at: nurseCompletion?.completed_at || null,
    };
  });

  // 상태 필터링 (둘 중 하나라도 완료하면 완료 처리)
  if (params.status === 'pending') {
    return tasks.filter((task) => !task.coordinator_completed && !task.nurse_completed);
  } else if (params.status === 'completed') {
    return tasks.filter((task) => task.coordinator_completed || task.nurse_completed);
  }

  return tasks;
}

/**
 * 환자 히스토리 조회
 */
export async function getPatientHistory(
  supabase: SupabaseClient<Database>,
  params: GetPatientHistoryParams,
): Promise<PatientHistory> {
  const { patient_id, months } = params;
  // months=0이면 전체 기간 조회
  const fromDate = months === 0 ? '2000-01-01' : getMonthsAgoString(months || 1);

  // 모든 쿼리를 병렬로 실행
  const [
    { data: patient, error: patientError },
    { data: consultations },
    { data: messages },
    { data: vitals },
  ] = await Promise.all([
    supabase.from('patients')
      .select(`
        id,
        name,
        gender,
        birth_date,
        room_number,
        coordinator:coordinator_id(name),
        doctor:doctor_id(name)
      `)
      .eq('id', patient_id)
      .returns<PatientWithJoins[]>()
      .single(),
    supabase.from('consultations')
      .select(`
        id,
        date,
        note,
        has_task,
        task_content,
        task_target,
        created_at,
        doctor:doctor_id(name)
      `)
      .eq('patient_id', patient_id)
      .gte('date', fromDate)
      .order('date', { ascending: false })
      .returns<ConsultationWithDoctor[]>(),
    supabase.from('messages')
      .select(`
        id,
        date,
        author_id,
        content,
        is_read,
        author_role,
        created_at,
        author:author_id(name)
      `)
      .eq('patient_id', patient_id)
      .gte('date', fromDate)
      .order('date', { ascending: false })
      .returns<MessageWithAuthor[]>(),
    supabase.from('vitals')
      .select('date, systolic, diastolic, blood_sugar')
      .eq('patient_id', patient_id)
      .gte('date', fromDate)
      .order('date', { ascending: false })
      .returns<VitalsResult[]>(),
  ]);

  if (patientError || !patient) {
    throw new DoctorError(
      DoctorErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      gender: patient.gender,
      birth_date: patient.birth_date ?? null,
      room_number: patient.room_number,
      coordinator_name: patient.coordinator?.name || null,
      doctor_name: patient.doctor?.name || null,
    },
    consultations: (consultations || []).map((c) => ({
      id: c.id,
      date: c.date,
      doctor_name: c.doctor?.name || '알 수 없음',
      note: c.note,
      has_task: c.has_task,
      task_content: c.task_content,
      task_target: c.task_target,
      created_at: c.created_at || null,
    })),
    messages: (messages || []).map((m) => ({
      id: m.id,
      date: m.date,
      author_id: m.author_id,
      author_name: m.author?.name || '알 수 없음',
      author_role: m.author_role,
      content: m.content,
      is_read: m.is_read,
      created_at: m.created_at,
    })),
    vitals: (vitals || []).map((v) => ({
      date: v.date,
      systolic: v.systolic,
      diastolic: v.diastolic,
      blood_sugar: v.blood_sugar,
    })),
  };
}

/**
 * 전달사항 목록 조회 (날짜 범위 지원)
 */
export async function getMessages(
  supabase: SupabaseClient<Database>,
  params: GetMessagesParams,
  options?: { coordinatorId?: string },
): Promise<DoctorMessage[]> {
  let query = supabase
    .from('messages')
    .select(`
      id,
      patient_id,
      date,
      content,
      is_read,
      author_role,
      created_at,
      patients!inner(name, coordinator_id),
      author:author_id(name)
    `)
    .order('created_at', { ascending: false });

  // 코디네이터인 경우 담당 환자만 필터
  if (options?.coordinatorId) {
    query = query.eq('patients.coordinator_id', options.coordinatorId);
  }

  // date range 우선, 없으면 단일 date
  if (params.start_date && params.end_date) {
    query = query.gte('date', params.start_date).lte('date', params.end_date);
  } else {
    query = query.eq('date', params.date || getTodayString());
  }

  // 읽음 상태 필터
  if (params.is_read === 'read') {
    query = query.eq('is_read', true);
  } else if (params.is_read === 'unread') {
    query = query.eq('is_read', false);
  }

  const { data: rawMessages, error } = await query;
  const messages = rawMessages as MessageWithPatient[] | null;

  if (error) {
    throw new DoctorError(
      DoctorErrorCode.INVALID_REQUEST,
      `전달사항 조회에 실패했습니다: ${error.message}`,
    );
  }

  return (messages || []).map((m) => ({
    id: m.id,
    patient_id: m.patient_id,
    patient_name: m.patients?.name || '알 수 없음',
    date: m.date,
    author_name: m.author?.name || '알 수 없음',
    author_role: m.author_role,
    content: m.content,
    is_read: m.is_read,
    created_at: m.created_at,
  }));
}

/**
 * 메시지 읽음 처리
 */
export async function markMessageRead(
  supabase: SupabaseClient<Database>,
  params: MarkMessageReadRequest,
): Promise<{ success: boolean }> {
  const { message_id } = params;

  const { error } = await supabase
    .from('messages')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', message_id);

  if (error) {
    throw new DoctorError(
      DoctorErrorCode.MESSAGE_NOT_FOUND,
      '메시지를 찾을 수 없습니다',
    );
  }

  return { success: true };
}

/**
 * 대기 환자 목록 조회
 * 모든 활성 환자를 표시 (주치의가 요일별로 변경되므로 스케줄 무관)
 */
export async function getWaitingPatients(
  supabase: SupabaseClient<Database>,
  params: GetWaitingPatientsParams,
): Promise<WaitingPatient[]> {
  const date = params.date || getTodayString();

  // 모든 활성 환자 조회 (스케줄/출석 여부 무관)
  const { data: allPatients, error: patientsError } = await supabase
    .from('patients')
    .select(`
      id,
      name,
      display_name,
      avatar_url,
      gender,
      birth_date,
      room_number,
      coordinator:coordinator_id(name)
    `)
    .eq('status', 'active')
    .order('room_number', { ascending: true })
    .returns<PatientWithCoordinator[]>();

  if (patientsError) {
    throw new DoctorError(
      DoctorErrorCode.INVALID_REQUEST,
      `환자 목록 조회에 실패했습니다: ${patientsError.message}`,
    );
  }

  const patientList = (allPatients || []).map((p) => ({
    patient_id: p.id,
    patients: p,
  }));

  if (patientList.length === 0) {
    return [];
  }

  // 환자 ID 목록
  const patientIds = patientList.map((p) => p.patient_id);

  // 단계 2: 독립적인 5개 쿼리 병렬 실행 (ensureScheduleGenerated 포함)
  const [
    { data: attendances },
    { data: consultations },
    { data: unreadMessages },
    { data: vitals },
  ] = await Promise.all([
    supabase.from('attendances')
      .select('patient_id, checked_at')
      .eq('date', date)
      .in('patient_id', patientIds)
      .returns<AttendanceResult[]>(),
    supabase.from('consultations')
      .select('patient_id, has_task, task_completions(is_completed)')
      .eq('date', date)
      .in('patient_id', patientIds)
      .returns<ConsultationWithTaskCompletions[]>(),
    supabase.from('messages')
      .select('patient_id')
      .eq('date', date)
      .eq('is_read', false)
      .in('patient_id', patientIds)
      .returns<MessagePatientId[]>(),
    supabase.from('vitals')
      .select('patient_id, systolic, diastolic, blood_sugar')
      .eq('date', date)
      .in('patient_id', patientIds)
      .returns<VitalsForPatient[]>(),
    ensureScheduleGenerated(supabase, date),
  ]);

  // 출석 Map 생성
  const attendanceMap = new Map<string, string>();
  (attendances || []).forEach((a) => {
    attendanceMap.set(a.patient_id, a.checked_at);
  });

  // 진찰 기록 Map (지시사항 상태 포함)
  const consultationMap = new Map<string, ConsultationWithTaskCompletions>(
    (consultations || []).map((c) => [c.patient_id, c])
  );

  const unreadMap = new Map<string, number>();
  (unreadMessages || []).forEach((m) => {
    unreadMap.set(m.patient_id, (unreadMap.get(m.patient_id) || 0) + 1);
  });

  // 활력징후 Map 생성
  const vitalsMap = new Map<string, { systolic: number | null; diastolic: number | null; blood_sugar: number | null }>();
  (vitals || []).forEach((v) => {
    vitalsMap.set(v.patient_id, {
      systolic: v.systolic,
      diastolic: v.diastolic,
      blood_sugar: v.blood_sugar,
    });
  });

  // 단계 3: ensureScheduleGenerated 완료 후 스케줄/지시사항 쿼리 병렬 실행
  const [
    { data: scheduledAttendances },
    { data: taskConsultations },
  ] = await Promise.all([
    supabase.from('scheduled_attendances')
      .select('patient_id')
      .eq('date', date)
      .eq('is_cancelled', false)
      .in('patient_id', patientIds)
      .returns<ScheduledAttendanceResult[]>(),
    supabase.from('consultations')
      .select('id, patient_id, task_target')
      .eq('date', date)
      .eq('has_task', true)
      .in('patient_id', patientIds)
      .returns<ConsultationForTask[]>(),
  ]);

  const scheduledSet = new Set<string>(
    (scheduledAttendances || []).map((s) => s.patient_id),
  );

  // 단계 4: 지시사항 완료 상태 조회 (조건부)
  const taskConsultationIds = (taskConsultations || []).map((c) => c.id);
  let taskCompletions: TaskCompletionStatus[] = [];
  if (taskConsultationIds.length > 0) {
    const { data } = await supabase
      .from('task_completions')
      .select('consultation_id, role, is_completed')
      .in('consultation_id', taskConsultationIds)
      .returns<TaskCompletionStatus[]>();
    taskCompletions = data || [];
  }

  // 환자별 지시사항 상태 Map: 'none' | 'pending' | 'completed'
  const taskStatusMap = new Map<string, 'none' | 'pending' | 'completed'>();
  (taskConsultations || []).forEach((c) => {
    const completions = taskCompletions.filter((tc) => tc.consultation_id === c.id);
    const allCompleted = completions.length > 0 && completions.every((tc) => tc.is_completed);

    const currentStatus = taskStatusMap.get(c.patient_id);
    if (!currentStatus || currentStatus === 'none') {
      taskStatusMap.set(c.patient_id, allCompleted ? 'completed' : 'pending');
    } else if (currentStatus === 'completed' && !allCompleted) {
      // 하나라도 미완료면 pending으로 변경
      taskStatusMap.set(c.patient_id, 'pending');
    }
  });

  // 결과 변환 - 출석 체크 여부와 상관없이 모든 예정 환자 반환
  return patientList.map((p) => ({
    id: p.patients.id,
    name: p.patients.name,
    display_name: p.patients.display_name ?? null,
    avatar_url: p.patients.avatar_url ?? null,
    gender: p.patients.gender,
    birth_date: p.patients.birth_date ?? null,
    room_number: p.patients.room_number,
    coordinator_name: p.patients.coordinator?.name || null,
    checked_at: attendanceMap.get(p.patient_id) || null,
    is_scheduled: scheduledSet.has(p.patient_id),
    vitals: vitalsMap.get(p.patient_id) || null,
    has_consultation: !!consultationMap.get(p.patient_id),
    unread_message_count: unreadMap.get(p.patient_id) || 0,
    task_status: taskStatusMap.get(p.patient_id) || 'none',
  }));
}

/**
 * 진찰 기록 생성
 * 출석 기록이 없는 경우 자동으로 출석 기록도 생성
 */
export async function createConsultation(
  supabase: SupabaseClient<Database>,
  doctorId: string,
  params: CreateConsultationRequest,
): Promise<CreatedConsultation> {
  const date = params.date || getTodayString();

  // 환자 존재 확인 (coordinator_id도 함께 조회)
  const { data: rawPatient, error: patientError } = await supabase
    .from('patients')
    .select('id, coordinator_id')
    .eq('id', params.patient_id)
    .single();

  const patient = rawPatient as PatientIdWithCoordinator | null;

  if (patientError || !patient) {
    throw new DoctorError(
      DoctorErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  // 출석 기록 확인 및 자동 생성
  const { data: existingAttendance } = await supabase
    .from('attendances')
    .select('id')
    .eq('patient_id', params.patient_id)
    .eq('date', date)
    .single();

  // 출석 기록이 없으면 자동 생성
  if (!existingAttendance) {
    const { error: attendanceError } = await supabase
      .from('attendances')
      .insert({
        patient_id: params.patient_id,
        date,
        checked_at: new Date().toISOString(),
      });

    if (attendanceError) {
      console.error('출석 기록 생성 실패:', attendanceError.message);
    }
  }

  // 진찰 기록 생성 (같은 환자+날짜에 이미 기록이 있으면 업데이트)
  type ConsultationsRowType = Database['public']['Tables']['consultations']['Row'];
  const { data: rawConsultation, error: consultationError } = await supabase
    .from('consultations')
    .upsert({
      patient_id: params.patient_id,
      doctor_id: doctorId,
      date,
      note: params.note || null,
      has_task: params.has_task || false,
      task_content: params.task_content || null,
      task_target: params.task_target || null,
      checked_by_coordinator: false,
    }, { onConflict: 'patient_id,date' })
    .select()
    .single();

  const consultation = rawConsultation as ConsultationsRowType | null;

  if (consultationError || !consultation) {
    throw new DoctorError(
      DoctorErrorCode.INVALID_REQUEST,
      `진찰 기록 생성에 실패했습니다: ${consultationError?.message ?? 'unknown error'}`,
    );
  }

  // has_task가 true인 경우 task_completions 레코드 생성 (기존 레코드 삭제 후 재생성)
  if (params.has_task && params.task_target) {
    // 기존 미완료 task_completions 삭제 (이미 완료된 건 유지)
    await supabase
      .from('task_completions')
      .delete()
      .eq('consultation_id', consultation.id)
      .eq('is_completed', false);

    const completionRecords: TaskCompletionsInsert[] = [];

    if (params.task_target === 'coordinator' || params.task_target === 'both') {
      completionRecords.push({
        consultation_id: consultation.id,
        completed_by: patient.coordinator_id || doctorId,
        role: 'coordinator',
        is_completed: false,
      });
    }

    if (params.task_target === 'nurse' || params.task_target === 'both') {
      completionRecords.push({
        consultation_id: consultation.id,
        completed_by: doctorId,
        role: 'nurse',
        is_completed: false,
      });
    }

    if (completionRecords.length > 0) {
      await supabase
        .from('task_completions')
        .insert(completionRecords);
    }
  }

  return {
    id: consultation.id,
    patient_id: consultation.patient_id,
    date: consultation.date,
    doctor_id: consultation.doctor_id,
    note: consultation.note,
    has_task: consultation.has_task,
    task_content: consultation.task_content,
    task_target: consultation.task_target,
    created_at: consultation.created_at,
  };
}

/**
 * 환자별 전달사항 조회 (의사용)
 */
export async function getPatientMessages(
  supabase: SupabaseClient<Database>,
  params: GetPatientMessagesParams,
): Promise<PatientMessage[]> {
  const date = params.date || getTodayString();

  const { data: rawMessages, error } = await supabase
    .from('messages')
    .select(`
      id,
      content,
      is_read,
      author_role,
      created_at,
      author:author_id(name)
    `)
    .eq('patient_id', params.patient_id)
    .eq('date', date)
    .order('created_at', { ascending: false });

  if (error) {
    throw new DoctorError(
      DoctorErrorCode.INVALID_REQUEST,
      `전달사항 조회에 실패했습니다: ${error.message}`,
    );
  }

  const messages = (rawMessages || []) as PatientMessageWithAuthor[];

  return messages.map((m) => ({
    id: m.id,
    author_name: m.author?.name || '알 수 없음',
    author_role: m.author_role,
    content: m.content,
    is_read: m.is_read,
    created_at: m.created_at,
  }));
}

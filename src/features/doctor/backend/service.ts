import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  GetTasksParams,
  GetPatientHistoryParams,
  MarkMessageReadRequest,
  GetWaitingPatientsParams,
  CreateConsultationRequest,
  GetPatientMessagesParams,
  TaskItem,
  PatientHistory,
  TodayMessage,
  WaitingPatient,
  CreatedConsultation,
  PatientMessage,
} from './schema';
import { DoctorError, DoctorErrorCode } from './error';
import { getTodayString, getMonthsAgoString } from '@/lib/date';

/**
 * 오늘 지시사항 목록 조회
 */
export async function getTasks(
  supabase: SupabaseClient<Database>,
  doctorId: string,
  params: GetTasksParams,
): Promise<TaskItem[]> {
  const date = params.date || getTodayString();

  // 오늘의 진찰 기록 중 has_task가 true인 것만 조회
  const { data: consultations, error: consultationsError } = await (supabase
    .from('consultations') as any)
    .select(`
      id,
      patient_id,
      task_content,
      task_target,
      created_at,
      patients!inner(
        id,
        name,
        room_number,
        coordinator:coordinator_id(name)
      )
    `)
    .eq('date', date)
    .eq('has_task', true)
    .order('created_at', { ascending: false });

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
  const consultationIds = consultations.map((c: any) => c.id);

  // task_completions 조회
  const { data: completions } = await (supabase
    .from('task_completions') as any)
    .select('consultation_id, role, is_completed, completed_at')
    .in('consultation_id', consultationIds);

  // completion Map 생성
  const completionMap = new Map<string, any[]>();
  (completions || []).forEach((tc: any) => {
    if (!completionMap.has(tc.consultation_id)) {
      completionMap.set(tc.consultation_id, []);
    }
    completionMap.get(tc.consultation_id)!.push(tc);
  });

  // 결과 변환
  const tasks: TaskItem[] = consultations.map((c: any) => {
    const taskCompletions = completionMap.get(c.id) || [];
    const coordinatorCompletion = taskCompletions.find((tc: any) => tc.role === 'coordinator');
    const nurseCompletion = taskCompletions.find((tc: any) => tc.role === 'nurse');

    return {
      consultation_id: c.id,
      patient_id: c.patient_id,
      patient_name: c.patients?.name || '알 수 없음',
      room_number: c.patients?.room_number || null,
      coordinator_name: c.patients?.coordinator?.name || null,
      task_content: c.task_content || '',
      task_target: c.task_target,
      created_at: c.created_at,
      coordinator_completed: coordinatorCompletion?.is_completed || false,
      coordinator_completed_at: coordinatorCompletion?.completed_at || null,
      nurse_completed: nurseCompletion?.is_completed || false,
      nurse_completed_at: nurseCompletion?.completed_at || null,
    };
  });

  // 상태 필터링
  if (params.status === 'pending') {
    return tasks.filter((task) => {
      if (task.task_target === 'coordinator') return !task.coordinator_completed;
      if (task.task_target === 'nurse') return !task.nurse_completed;
      if (task.task_target === 'both') return !task.coordinator_completed || !task.nurse_completed;
      return true;
    });
  } else if (params.status === 'completed') {
    return tasks.filter((task) => {
      if (task.task_target === 'coordinator') return task.coordinator_completed;
      if (task.task_target === 'nurse') return task.nurse_completed;
      if (task.task_target === 'both') return task.coordinator_completed && task.nurse_completed;
      return false;
    });
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
    (supabase.from('patients') as any)
      .select(`
        id,
        name,
        gender,
        room_number,
        coordinator:coordinator_id(name),
        doctor:doctor_id(name)
      `)
      .eq('id', patient_id)
      .single(),
    (supabase.from('consultations') as any)
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
      .order('date', { ascending: false }),
    (supabase.from('messages') as any)
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
      .order('date', { ascending: false }),
    (supabase.from('vitals') as any)
      .select('date, systolic, diastolic, blood_sugar')
      .eq('patient_id', patient_id)
      .gte('date', fromDate)
      .order('date', { ascending: false }),
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
      room_number: patient.room_number,
      coordinator_name: patient.coordinator?.name || null,
      doctor_name: patient.doctor?.name || null,
    },
    consultations: (consultations || []).map((c: any) => ({
      id: c.id,
      date: c.date,
      doctor_name: c.doctor?.name || '알 수 없음',
      note: c.note,
      has_task: c.has_task,
      task_content: c.task_content,
      task_target: c.task_target,
      created_at: c.created_at || null,
    })),
    messages: (messages || []).map((m: any) => ({
      id: m.id,
      date: m.date,
      author_id: m.author_id,
      author_name: m.author?.name || '알 수 없음',
      author_role: m.author_role,
      content: m.content,
      is_read: m.is_read,
      created_at: m.created_at,
    })),
    vitals: (vitals || []).map((v: any) => ({
      date: v.date,
      systolic: v.systolic,
      diastolic: v.diastolic,
      blood_sugar: v.blood_sugar,
    })),
  };
}

/**
 * 오늘 전달사항 목록 조회
 */
export async function getTodayMessages(
  supabase: SupabaseClient<Database>,
  date?: string,
): Promise<TodayMessage[]> {
  const targetDate = date || getTodayString();

  const { data: messages, error } = await (supabase
    .from('messages') as any)
    .select(`
      id,
      patient_id,
      content,
      is_read,
      author_role,
      created_at,
      patients!inner(name),
      author:author_id(name)
    `)
    .eq('date', targetDate)
    .order('created_at', { ascending: false });

  if (error) {
    throw new DoctorError(
      DoctorErrorCode.INVALID_REQUEST,
      `전달사항 조회에 실패했습니다: ${error.message}`,
    );
  }

  return (messages || []).map((m: any) => ({
    id: m.id,
    patient_id: m.patient_id,
    patient_name: m.patients?.name || '알 수 없음',
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

  const { error } = await (supabase
    .from('messages') as any)
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
  const { data: allPatients, error: patientsError } = await (supabase
    .from('patients') as any)
    .select(`
      id,
      name,
      gender,
      room_number,
      coordinator:coordinator_id(name)
    `)
    .eq('status', 'active')
    .order('room_number', { ascending: true });

  if (patientsError) {
    throw new DoctorError(
      DoctorErrorCode.INVALID_REQUEST,
      `환자 목록 조회에 실패했습니다: ${patientsError.message}`,
    );
  }

  const patientList = (allPatients || []).map((p: any) => ({
    patient_id: p.id,
    patients: p,
  }));

  if (patientList.length === 0) {
    return [];
  }

  // 환자 ID 목록
  const patientIds = patientList.map((p: any) => p.patient_id);

  // 오늘 출석 기록 조회
  const { data: attendances } = await (supabase
    .from('attendances') as any)
    .select('patient_id, checked_at')
    .eq('date', date)
    .in('patient_id', patientIds);

  // 출석 Map 생성
  const attendanceMap = new Map<string, string>();
  (attendances || []).forEach((a: any) => {
    attendanceMap.set(a.patient_id, a.checked_at);
  });

  // 오늘 진찰 기록 조회 (지시사항 포함)
  const { data: consultations } = await (supabase
    .from('consultations') as any)
    .select('patient_id, has_task, task_completions(is_completed)')
    .eq('date', date)
    .in('patient_id', patientIds);

  // 진찰 기록 Map (지시사항 상태 포함)
  const consultationMap = new Map<string, any>(
    (consultations || []).map((c: any) => [c.patient_id, c])
  );

  // 오늘 미확인 전달사항 조회
  const { data: unreadMessages } = await (supabase
    .from('messages') as any)
    .select('patient_id')
    .eq('date', date)
    .eq('is_read', false)
    .in('patient_id', patientIds);

  const unreadMap = new Map<string, number>();
  (unreadMessages || []).forEach((m: any) => {
    unreadMap.set(m.patient_id, (unreadMap.get(m.patient_id) || 0) + 1);
  });

  // 오늘 활력징후 조회
  const { data: vitals } = await (supabase
    .from('vitals') as any)
    .select('patient_id, systolic, diastolic, blood_sugar')
    .eq('date', date)
    .in('patient_id', patientIds);

  // 활력징후 Map 생성
  const vitalsMap = new Map<string, any>();
  (vitals || []).forEach((v: any) => {
    vitalsMap.set(v.patient_id, {
      systolic: v.systolic,
      diastolic: v.diastolic,
      blood_sugar: v.blood_sugar,
    });
  });

  // 오늘 지시사항이 있는 진찰 기록 조회
  const { data: taskConsultations } = await (supabase
    .from('consultations') as any)
    .select('id, patient_id, task_target')
    .eq('date', date)
    .eq('has_task', true)
    .in('patient_id', patientIds);

  // 지시사항 완료 상태 조회
  const taskConsultationIds = (taskConsultations || []).map((c: any) => c.id);
  let taskCompletions: any[] = [];
  if (taskConsultationIds.length > 0) {
    const { data } = await (supabase
      .from('task_completions') as any)
      .select('consultation_id, role, is_completed')
      .in('consultation_id', taskConsultationIds);
    taskCompletions = data || [];
  }

  // 환자별 지시사항 상태 Map: 'none' | 'pending' | 'completed'
  const taskStatusMap = new Map<string, 'none' | 'pending' | 'completed'>();
  (taskConsultations || []).forEach((c: any) => {
    const completions = taskCompletions.filter((tc: any) => tc.consultation_id === c.id);
    const allCompleted = completions.length > 0 && completions.every((tc: any) => tc.is_completed);

    const currentStatus = taskStatusMap.get(c.patient_id);
    if (!currentStatus || currentStatus === 'none') {
      taskStatusMap.set(c.patient_id, allCompleted ? 'completed' : 'pending');
    } else if (currentStatus === 'completed' && !allCompleted) {
      // 하나라도 미완료면 pending으로 변경
      taskStatusMap.set(c.patient_id, 'pending');
    }
  });

  // 결과 변환 - 출석 체크 여부와 상관없이 모든 예정 환자 반환
  return patientList.map((p: any) => ({
    id: p.patients.id,
    name: p.patients.name,
    gender: p.patients.gender,
    room_number: p.patients.room_number,
    coordinator_name: p.patients.coordinator?.name || null,
    checked_at: attendanceMap.get(p.patient_id) || null,
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
  const { data: patient, error: patientError } = await (supabase
    .from('patients') as any)
    .select('id, coordinator_id')
    .eq('id', params.patient_id)
    .single();

  if (patientError || !patient) {
    throw new DoctorError(
      DoctorErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  // 출석 기록 확인 및 자동 생성
  const { data: existingAttendance } = await (supabase
    .from('attendances') as any)
    .select('id')
    .eq('patient_id', params.patient_id)
    .eq('date', date)
    .single();

  // 출석 기록이 없으면 자동 생성
  if (!existingAttendance) {
    await (supabase
      .from('attendances') as any)
      .insert({
        patient_id: params.patient_id,
        date,
        checked_at: new Date().toISOString(),
      });
  }

  // 진찰 기록 생성 (같은 환자+날짜에 이미 기록이 있으면 업데이트)
  const { data: consultation, error: consultationError } = await (supabase
    .from('consultations') as any)
    .upsert({
      patient_id: params.patient_id,
      doctor_id: doctorId,
      date,
      note: params.note || null,
      has_task: params.has_task || false,
      task_content: params.task_content || null,
      task_target: params.task_target || null,
    }, { onConflict: 'patient_id,date' })
    .select()
    .single();

  if (consultationError) {
    throw new DoctorError(
      DoctorErrorCode.INVALID_REQUEST,
      `진찰 기록 생성에 실패했습니다: ${consultationError.message}`,
    );
  }

  // has_task가 true인 경우 task_completions 레코드 생성 (기존 레코드 삭제 후 재생성)
  if (params.has_task && params.task_target) {
    // 기존 미완료 task_completions 삭제 (이미 완료된 건 유지)
    await (supabase
      .from('task_completions') as any)
      .delete()
      .eq('consultation_id', consultation.id)
      .eq('is_completed', false);

    const completionRecords: any[] = [];

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
      await (supabase
        .from('task_completions') as any)
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

  const { data: messages, error } = await (supabase
    .from('messages') as any)
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

  return (messages || []).map((m: any) => ({
    id: m.id,
    author_name: m.author?.name || '알 수 없음',
    author_role: m.author_role,
    content: m.content,
    is_read: m.is_read,
    created_at: m.created_at,
  }));
}

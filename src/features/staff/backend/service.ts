import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  GetMyPatientsParams,
  GetPatientDetailParams,
  CompleteTaskRequest,
  CreateMessageRequest,
  UpdateSchedulePatternRequest,
  GetMessagesParams,
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
  TaskError,
} from '@/server/services/task';
import {
  createMessage as createMessageShared,
  MessageError,
} from '@/server/services/message';
import { getMonthsAgoString, getTodayString } from '@/lib/date';

/**
 * 담당 환자 목록 조회
 */
export async function getMyPatients(
  supabase: SupabaseClient<Database>,
  coordinatorId: string,
  params: GetMyPatientsParams,
): Promise<PatientSummary[]> {
  const date = params.date || new Date().toISOString().split('T')[0];

  const showAll = params.show_all === 'true';

  // show_all=true이면 RPC 스킵하고 직접 전체 환자 조회
  if (!showAll) {
    const { data, error } = await (supabase.rpc as any)('get_coordinator_patients', {
      p_coordinator_id: coordinatorId,
      p_date: date,
    });

    if (!error && data) {
      return data as PatientSummary[];
    }
  }

  {
    // 환자 목록 조회: show_all이면 전체, 아니면 담당만
    let patientsQuery = (supabase
      .from('patients') as any)
      .select(`
        id,
        name
      `)
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
    const patientIds = (patients || []).map((p: any) => p.id);

    if (patientIds.length === 0) {
      return [];
    }

    // 출석, 진찰, 메시지를 병렬로 조회
    const [
      { data: attendances },
      { data: consultations },
      { data: messages },
    ] = await Promise.all([
      (supabase.from('attendances') as any)
        .select('patient_id, checked_at')
        .in('patient_id', patientIds)
        .eq('date', date),
      (supabase.from('consultations') as any)
        .select(`
          patient_id,
          id,
          has_task,
          task_content,
          task_target,
          task_completions(is_completed)
        `)
        .in('patient_id', patientIds)
        .eq('date', date),
      (supabase.from('messages') as any)
        .select('patient_id, id, is_read')
        .in('patient_id', patientIds)
        .eq('date', date),
    ]);

    // 데이터를 Map으로 변환
    const attendanceMap = new Map<string, any>((attendances || []).map((a: any) => [a.patient_id, a]));
    const consultationMap = new Map<string, any>((consultations || []).map((c: any) => [c.patient_id, c]));
    const messageMap = new Map<string, any[]>();
    (messages || []).forEach((m: any) => {
      if (!messageMap.has(m.patient_id)) {
        messageMap.set(m.patient_id, []);
      }
      messageMap.get(m.patient_id)!.push(m);
    });

    // 데이터 변환 (Map에서 조회)
    return (patients || []).map((p: any) => {
      const attendance = attendanceMap.get(p.id);
      const consultation = consultationMap.get(p.id);
      const taskCompletions = consultation?.task_completions || [];
      const patientMessages = messageMap.get(p.id) || [];

      return {
        id: p.id,
        name: p.name,
        is_attended: !!attendance,
        attendance_time: attendance?.checked_at || null,
        is_consulted: !!consultation,
        has_task:
          consultation?.has_task &&
          (consultation?.task_target === 'coordinator' ||
            consultation?.task_target === 'both'),
        task_content: consultation?.task_content || null,
        task_completed:
          taskCompletions.length > 0
            ? taskCompletions.every((tc: any) => tc.is_completed)
            : false,
        unread_message_count: patientMessages.filter((m: any) => !m.is_read).length,
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
  const date = params.date || new Date().toISOString().split('T')[0];

  // 최근 진찰 기록 조회를 위한 날짜
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  // 모든 쿼리를 병렬로 실행 (patient_id는 이미 알고 있으므로)
  const [
    { data: patient, error: patientError },
    { data: attendance },
    { data: consultation },
    { data: vitals },
    { data: recentConsultations },
  ] = await Promise.all([
    (supabase.from('patients') as any)
      .select('id, name, gender, coordinator_id')
      .eq('id', params.patient_id)
      .single(),
    (supabase.from('attendances') as any)
      .select('checked_at')
      .eq('patient_id', params.patient_id)
      .eq('date', date)
      .maybeSingle(),
    (supabase.from('consultations') as any)
      .select(`
        id,
        note,
        has_task,
        task_content,
        task_target,
        task_completions(id, is_completed, completed_at, memo, role)
      `)
      .eq('patient_id', params.patient_id)
      .eq('date', date)
      .maybeSingle(),
    (supabase.from('vitals') as any)
      .select('systolic, diastolic, blood_sugar')
      .eq('patient_id', params.patient_id)
      .eq('date', date)
      .maybeSingle(),
    (supabase.from('consultations') as any)
      .select(`
        date,
        note,
        staff:doctor_id(name)
      `)
      .eq('patient_id', params.patient_id)
      .gte('date', oneMonthAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(10),
  ]);

  if (patientError || !patient) {
    throw new StaffError(
      StaffErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  // task_completions에서 coordinator 역할만 필터링
  const coordinatorTaskCompletion =
    (consultation as any)?.task_completions?.find(
      (tc: any) => tc.role === 'coordinator',
    ) || null;

  return {
    id: (patient as any).id,
    name: (patient as any).name,
    gender: (patient as any).gender,
    attendance: {
      is_attended: !!attendance,
      checked_at: (attendance as any)?.checked_at || null,
    },
    consultation: {
      is_consulted: !!consultation,
      note: (consultation as any)?.note || null,
      has_task:
        (consultation as any)?.has_task &&
        ((consultation as any)?.task_target === 'coordinator' ||
          (consultation as any)?.task_target === 'both'),
      task_content: (consultation as any)?.task_content || null,
      task_target: (consultation as any)?.task_target || null,
      consultation_id: (consultation as any)?.id || null,
      task_completion_id: coordinatorTaskCompletion?.id || null,
      is_task_completed: coordinatorTaskCompletion?.is_completed || false,
    },
    vitals: vitals || null,
    recent_consultations: (recentConsultations || []).map((rc: any) => ({
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
  try {
    const result = await completeTaskShared(supabase, staffId, 'coordinator', {
      consultation_id: params.consultation_id,
      memo: params.memo,
    });
    return result;
  } catch (error) {
    if (error instanceof TaskError) {
      const errorCodeMap: Record<string, StaffErrorCode> = {
        TASK_NOT_FOUND: StaffErrorCode.TASK_NOT_FOUND,
        TASK_ALREADY_COMPLETED: StaffErrorCode.TASK_ALREADY_COMPLETED,
        TASK_UPDATE_FAILED: StaffErrorCode.INVALID_REQUEST,
      };
      throw new StaffError(
        errorCodeMap[error.code] || StaffErrorCode.INVALID_REQUEST,
        error.message,
      );
    }
    throw error;
  }
}

/**
 * 전달사항 작성
 */
export async function createMessage(
  supabase: SupabaseClient<Database>,
  staffId: string,
  params: CreateMessageRequest,
): Promise<Message> {
  try {
    const result = await createMessageShared(supabase, staffId, 'coordinator', {
      patient_id: params.patient_id,
      date: params.date,
      content: params.content,
    });
    return result;
  } catch (error) {
    if (error instanceof MessageError) {
      throw new StaffError(StaffErrorCode.MESSAGE_SAVE_FAILED, error.message);
    }
    throw error;
  }
}

/**
 * 담당 환자 출석 패턴 목록 조회
 */
export async function getMyPatientsSchedulePatterns(
  supabase: SupabaseClient<Database>,
  coordinatorId: string,
): Promise<MyPatientSchedulePattern[]> {
  // 담당 환자 목록 조회
  const { data: patients, error: patientsError } = await (supabase
    .from('patients') as any)
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

  const patientIds = (patients || []).map((p: any) => p.id);

  if (patientIds.length === 0) {
    return [];
  }

  // 스케줄 패턴 조회
  const { data: patterns } = await (supabase
    .from('scheduled_patterns') as any)
    .select('patient_id, day_of_week')
    .in('patient_id', patientIds)
    .eq('is_active', true);

  const patternMap = new Map<string, number[]>();
  (patterns || []).forEach((p: any) => {
    if (!patternMap.has(p.patient_id)) {
      patternMap.set(p.patient_id, []);
    }
    patternMap.get(p.patient_id)!.push(p.day_of_week);
  });

  return (patients || []).map((p: any) => ({
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
  const { data: patient, error: patientError } = await (supabase
    .from('patients') as any)
    .select('id, coordinator_id')
    .eq('id', patientId)
    .single();

  if (patientError || !patient) {
    throw new StaffError(
      StaffErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  if ((patient as any).coordinator_id !== coordinatorId) {
    throw new StaffError(
      StaffErrorCode.UNAUTHORIZED,
      '담당 환자가 아닙니다',
    );
  }

  // 기존 패턴 삭제
  await (supabase
    .from('scheduled_patterns') as any)
    .delete()
    .eq('patient_id', patientId);

  // 새 패턴 생성
  if (request.schedule_days.length > 0) {
    const patternsToInsert = request.schedule_days.map((day) => ({
      patient_id: patientId,
      day_of_week: day,
      is_active: true,
    }));

    const { error: insertError } = await (supabase
      .from('scheduled_patterns') as any)
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
  const { data: messages, error: messagesError } = await (supabase
    .from('messages') as any)
    .select(`
      id,
      patient_id,
      date,
      content,
      is_read,
      created_at,
      patients!inner(name)
    `)
    .eq('author_id', authorId)
    .eq('date', date)
    .order('created_at', { ascending: false });

  if (messagesError) {
    throw new StaffError(
      StaffErrorCode.INVALID_REQUEST,
      `전달사항 조회에 실패했습니다: ${messagesError.message}`,
    );
  }

  return (messages || []).map((m: any) => ({
    id: m.id,
    patient_id: m.patient_id,
    patient_name: m.patients?.name || '알 수 없음',
    date: m.date,
    content: m.content,
    is_read: m.is_read,
    created_at: m.created_at,
  }));
}

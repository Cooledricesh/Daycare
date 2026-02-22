import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  GetPrescriptionsParams,
  GetNursePatientsParams,
  CompleteTaskRequest,
  CreateMessageRequest,
  PrescriptionItem,
  NursePatientSummary,
  TaskCompletion,
  Message,
} from './schema';
import { NurseError, NurseErrorCode } from './error';
import {
  completeTask as completeTaskShared,
  TaskError,
} from '@/server/services/task';
import {
  createMessage as createMessageShared,
  MessageError,
} from '@/server/services/message';
import { getTodayString } from '@/lib/date';

/**
 * 간호사 환자 목록 조회 (전체 활성 환자)
 */
export async function getNursePatients(
  supabase: SupabaseClient<Database>,
  params: GetNursePatientsParams,
): Promise<NursePatientSummary[]> {
  const date = params.date || getTodayString();

  // 1. 모든 활성 환자 조회
  const { data: patients, error: patientsError } = await (supabase
    .from('patients') as any)
    .select('id, name')
    .eq('status', 'active')
    .order('name');

  if (patientsError) {
    throw new NurseError(
      NurseErrorCode.INVALID_REQUEST,
      `환자 목록 조회에 실패했습니다: ${patientsError.message}`,
    );
  }

  const patientIds = (patients || []).map((p: any) => p.id);
  if (patientIds.length === 0) return [];

  // 2. 오늘 출석 정보
  const { data: attendances } = await (supabase
    .from('attendances') as any)
    .select('patient_id, checked_at')
    .in('patient_id', patientIds)
    .eq('date', date);

  // 3. 오늘 진료 기록 + 지시사항 + 담당의
  const { data: consultations } = await (supabase
    .from('consultations') as any)
    .select(`
      id,
      patient_id,
      note,
      has_task,
      task_content,
      task_target,
      staff!consultations_doctor_id_fkey(name),
      task_completions(id, is_completed, completed_at, role)
    `)
    .in('patient_id', patientIds)
    .eq('date', date);

  // 4. Map 생성
  const attendanceMap = new Map<string, any>(
    (attendances || []).map((a: any) => [a.patient_id, a]),
  );
  const consultationMap = new Map<string, any>(
    (consultations || []).map((c: any) => [c.patient_id, c]),
  );

  // 5. 데이터 변환
  const hasNurseTask = (c: any) =>
    c?.has_task && (c?.task_target === 'nurse' || c?.task_target === 'both');

  const items: NursePatientSummary[] = (patients || []).map((p: any) => {
    const attendance = attendanceMap.get(p.id);
    const consultation = consultationMap.get(p.id);
    const nurseTaskCompletion = consultation?.task_completions?.find(
      (tc: any) => tc.role === 'nurse',
    );

    return {
      id: p.id,
      name: p.name,
      is_attended: !!attendance,
      attendance_time: attendance?.checked_at || null,
      is_consulted: !!consultation,
      has_nurse_task: hasNurseTask(consultation),
      task_content: consultation?.task_content || null,
      task_completed: hasNurseTask(consultation)
        ? (nurseTaskCompletion?.is_completed || false)
        : false,
      consultation_id: consultation?.id || null,
      task_completion_id: nurseTaskCompletion?.id || null,
      doctor_name: consultation?.staff?.name || null,
      note: consultation?.note || null,
    };
  });

  // 6. 필터 적용
  if (params.filter === 'pending') {
    return items.filter((item) => item.has_nurse_task && !item.task_completed);
  }
  if (params.filter === 'completed') {
    return items.filter((item) => !item.has_nurse_task || item.task_completed);
  }
  return items;
}

/**
 * 처방 변경 목록 조회
 */
export async function getPrescriptions(
  supabase: SupabaseClient<Database>,
  params: GetPrescriptionsParams,
): Promise<PrescriptionItem[]> {
  const date = params.date || new Date().toISOString().split('T')[0];

  // 오늘 모든 진료 기록 조회 (간호사가 투약 변경/진료 메모 확인용)
  let query = (supabase
    .from('consultations') as any)
    .select(`
      id,
      patient_id,
      note,
      has_task,
      task_content,
      task_target,
      created_at,
      patients!inner(name, coordinator_id),
      staff!consultations_doctor_id_fkey(name),
      task_completions(id, is_completed, completed_at, role)
    `)
    .eq('date', date);

  const { data, error } = await query;

  if (error) {
    throw new NurseError(
      NurseErrorCode.INVALID_REQUEST,
      `처방 변경 목록 조회에 실패했습니다: ${error.message}`,
    );
  }

  if (!data) {
    return [];
  }

  // 데이터 변환 및 필터링
  const hasNurseTask = (c: any) =>
    c.has_task && (c.task_target === 'nurse' || c.task_target === 'both');

  const items: PrescriptionItem[] = (data as any[])
    .map((c) => {
      const nurseTaskCompletion = c.task_completions?.find(
        (tc: any) => tc.role === 'nurse',
      );

      return {
        consultation_id: c.id,
        patient_id: c.patient_id,
        patient_name: c.patients?.name || '알 수 없음',
        coordinator_name: null,
        doctor_name: c.staff?.name || '알 수 없음',
        note: c.note || null,
        has_task: hasNurseTask(c),
        task_content: c.task_content || '',
        is_completed: hasNurseTask(c)
          ? (nurseTaskCompletion?.is_completed || false)
          : true, // 지시사항이 없으면 완료 처리
        completed_at: nurseTaskCompletion?.completed_at || null,
        task_completion_id: nurseTaskCompletion?.id || null,
        created_at: c.created_at,
      };
    })
    .filter((item) => {
      if (params.filter === 'pending') {
        return !item.is_completed;
      }
      if (params.filter === 'completed') {
        return item.is_completed;
      }
      return true; // 'all'
    });

  return items;
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
    const result = await completeTaskShared(supabase, staffId, 'nurse', {
      consultation_id: params.consultation_id,
      memo: params.memo,
    });
    return result;
  } catch (error) {
    if (error instanceof TaskError) {
      const errorCodeMap: Record<string, NurseErrorCode> = {
        TASK_NOT_FOUND: NurseErrorCode.TASK_NOT_FOUND,
        TASK_ALREADY_COMPLETED: NurseErrorCode.TASK_ALREADY_COMPLETED,
        TASK_UPDATE_FAILED: NurseErrorCode.INVALID_REQUEST,
      };
      throw new NurseError(
        errorCodeMap[error.code] || NurseErrorCode.INVALID_REQUEST,
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
    const result = await createMessageShared(supabase, staffId, 'nurse', {
      patient_id: params.patient_id,
      date: params.date,
      content: params.content,
    });
    return result;
  } catch (error) {
    if (error instanceof MessageError) {
      throw new NurseError(NurseErrorCode.MESSAGE_SAVE_FAILED, error.message);
    }
    throw error;
  }
}

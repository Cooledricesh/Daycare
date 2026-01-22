import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  GetPrescriptionsParams,
  CompleteTaskRequest,
  CreateMessageRequest,
  PrescriptionItem,
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
 * 처방 변경 목록 조회
 */
export async function getPrescriptions(
  supabase: SupabaseClient<Database>,
  params: GetPrescriptionsParams,
): Promise<PrescriptionItem[]> {
  const date = params.date || new Date().toISOString().split('T')[0];

  // 오늘 처방 변경 건 조회 (nurse 또는 both 대상)
  let query = (supabase
    .from('consultations') as any)
    .select(`
      id,
      patient_id,
      task_content,
      created_at,
      patients!inner(name, coordinator_id),
      staff!consultations_doctor_id_fkey(name),
      task_completions(id, is_completed, completed_at, role)
    `)
    .eq('date', date)
    .eq('has_task', true)
    .in('task_target', ['nurse', 'both']);

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
  const items: PrescriptionItem[] = (data as any[])
    .map((c) => {
      const nurseTaskCompletion = c.task_completions?.find(
        (tc: any) => tc.role === 'nurse',
      );

      return {
        consultation_id: c.id,
        patient_id: c.patient_id,
        patient_name: c.patients?.name || '알 수 없음',
        coordinator_name: null, // TODO: coordinator 정보 추가
        doctor_name: c.staff?.name || '알 수 없음',
        task_content: c.task_content || '',
        is_completed: nurseTaskCompletion?.is_completed || false,
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

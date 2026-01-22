import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export type TaskRole = 'coordinator' | 'nurse';

export interface CompleteTaskParams {
  consultation_id: string;
  memo?: string;
}

export interface TaskCompletionResult {
  id: string;
  consultation_id: string;
  is_completed: boolean;
  completed_at: string | null;
  memo: string | null;
}

export class TaskError extends Error {
  constructor(
    public code: 'TASK_NOT_FOUND' | 'TASK_ALREADY_COMPLETED' | 'TASK_UPDATE_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'TaskError';
  }
}

/**
 * 지시사항 처리 완료 (공통 로직)
 * Staff와 Nurse 모듈에서 공통으로 사용
 */
export async function completeTask(
  supabase: SupabaseClient<Database>,
  staffId: string,
  role: TaskRole,
  params: CompleteTaskParams,
): Promise<TaskCompletionResult> {
  // consultation_id로 task_completion 찾기
  const { data: taskCompletion, error: findError } = await (supabase
    .from('task_completions') as any)
    .select('id, is_completed')
    .eq('consultation_id', params.consultation_id)
    .eq('completed_by', staffId)
    .eq('role', role)
    .maybeSingle();

  if (findError) {
    throw new TaskError(
      'TASK_NOT_FOUND',
      `지시사항을 찾을 수 없습니다: ${findError.message}`,
    );
  }

  if (!taskCompletion) {
    throw new TaskError('TASK_NOT_FOUND', '지시사항을 찾을 수 없습니다');
  }

  if (taskCompletion.is_completed) {
    throw new TaskError(
      'TASK_ALREADY_COMPLETED',
      '이미 처리 완료된 지시사항입니다',
    );
  }

  // 처리 완료로 업데이트
  const { data, error } = await (supabase
    .from('task_completions') as any)
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      memo: params.memo || null,
    })
    .eq('id', taskCompletion.id)
    .select()
    .single();

  if (error || !data) {
    throw new TaskError(
      'TASK_UPDATE_FAILED',
      `지시사항 처리에 실패했습니다: ${error?.message || '알 수 없는 오류'}`,
    );
  }

  return {
    id: data.id,
    consultation_id: data.consultation_id,
    is_completed: data.is_completed,
    completed_at: data.completed_at,
    memo: data.memo,
  };
}

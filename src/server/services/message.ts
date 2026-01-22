import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export type MessageAuthorRole = 'coordinator' | 'nurse';

export interface CreateMessageParams {
  patient_id: string;
  date: string;
  content: string;
}

export interface MessageResult {
  id: string;
  patient_id: string;
  date: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export class MessageError extends Error {
  constructor(
    public code: 'MESSAGE_SAVE_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'MessageError';
  }
}

/**
 * 전달사항 작성 (공통 로직)
 * Staff와 Nurse 모듈에서 공통으로 사용
 */
export async function createMessage(
  supabase: SupabaseClient<Database>,
  authorId: string,
  authorRole: MessageAuthorRole,
  params: CreateMessageParams,
): Promise<MessageResult> {
  const insertData = {
    patient_id: params.patient_id,
    date: params.date,
    author_id: authorId,
    author_role: authorRole,
    content: params.content,
    is_read: false,
  };

  const { data, error } = await (supabase
    .from('messages') as any)
    .insert([insertData])
    .select()
    .single();

  if (error || !data) {
    throw new MessageError(
      'MESSAGE_SAVE_FAILED',
      `전달사항 저장에 실패했습니다: ${error?.message || '알 수 없는 오류'}`,
    );
  }

  return {
    id: data.id,
    patient_id: data.patient_id,
    date: data.date,
    content: data.content,
    is_read: data.is_read,
    created_at: data.created_at,
  };
}

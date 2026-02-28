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
    public code: 'MESSAGE_SAVE_FAILED' | 'MESSAGE_DELETE_FAILED' | 'MESSAGE_NOT_OWNED',
    message: string,
  ) {
    super(message);
    this.name = 'MessageError';
  }
}

/**
 * 전달사항 삭제 (작성자 본인 또는 admin만 삭제 가능)
 */
export async function deleteMessage(
  supabase: SupabaseClient<Database>,
  messageId: string,
  authorId: string,
  isAdmin = false,
): Promise<void> {
  let query = (supabase.from('messages') as any)
    .delete()
    .eq('id', messageId);

  if (!isAdmin) {
    query = query.eq('author_id', authorId);
  }

  const { data, error } = await query.select('id');

  if (error) {
    throw new MessageError(
      'MESSAGE_DELETE_FAILED',
      `전달사항 삭제에 실패했습니다: ${error.message}`,
    );
  }

  if (!data || data.length === 0) {
    throw new MessageError(
      isAdmin ? 'MESSAGE_DELETE_FAILED' : 'MESSAGE_NOT_OWNED',
      isAdmin ? '전달사항을 찾을 수 없습니다.' : '본인이 작성한 전달사항만 삭제할 수 있습니다.',
    );
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

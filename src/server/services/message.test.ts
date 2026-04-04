import { describe, it, expect, beforeEach } from 'vitest';
import { createMessage, deleteMessage, updateMessage, MessageError } from './message';
import { createMockSupabase, type MockSupabaseChain } from '@/test-utils/supabase-mock';

describe('createMessage', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('전달사항을 생성한다', async () => {
    mock.mockSingle.mockReturnValueOnce({
      data: {
        id: 'msg-1',
        patient_id: 'p-1',
        date: '2026-04-04',
        content: '테스트 메시지',
        is_read: false,
        created_at: '2026-04-04T00:00:00Z',
      },
      error: null,
    });

    const result = await createMessage(mock.supabase, 'staff-1', 'coordinator', {
      patient_id: 'p-1',
      date: '2026-04-04',
      content: '테스트 메시지',
    });

    expect(result.id).toBe('msg-1');
    expect(result.content).toBe('테스트 메시지');
    expect(result.is_read).toBe(false);
    expect(mock.mockFrom).toHaveBeenCalledWith('messages');
    expect(mock.mockInsert).toHaveBeenCalled();
  });

  it('저장 실패 시 MESSAGE_SAVE_FAILED 에러', async () => {
    mock.mockSingle.mockReturnValueOnce({
      data: null,
      error: { message: 'insert failed' },
    });

    await expect(
      createMessage(mock.supabase, 'staff-1', 'coordinator', {
        patient_id: 'p-1',
        date: '2026-04-04',
        content: '테스트',
      }),
    ).rejects.toThrow(MessageError);

    try {
      mock.mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: 'insert failed' },
      });
      await createMessage(mock.supabase, 'staff-1', 'coordinator', {
        patient_id: 'p-1',
        date: '2026-04-04',
        content: '테스트',
      });
    } catch (error) {
      expect((error as MessageError).code).toBe('MESSAGE_SAVE_FAILED');
    }
  });

  it('data가 null이면 MESSAGE_SAVE_FAILED 에러', async () => {
    mock.mockSingle.mockReturnValueOnce({
      data: null,
      error: null,
    });

    await expect(
      createMessage(mock.supabase, 'staff-1', 'nurse', {
        patient_id: 'p-1',
        date: '2026-04-04',
        content: '테스트',
      }),
    ).rejects.toThrow(MessageError);
  });
});

describe('deleteMessage', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('본인 메시지를 삭제한다', async () => {
    // delete().eq('id').eq('author_id').select('id') 체인
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [{ id: 'msg-1' }], error: null }),
    });

    await expect(
      deleteMessage(mock.supabase, 'msg-1', 'staff-1'),
    ).resolves.toBeUndefined();

    expect(mock.mockFrom).toHaveBeenCalledWith('messages');
    expect(mock.mockDelete).toHaveBeenCalled();
  });

  it('타인 메시지 삭제 시 MESSAGE_NOT_OWNED 에러', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [], error: null }),
    });

    await expect(
      deleteMessage(mock.supabase, 'msg-1', 'staff-other'),
    ).rejects.toThrow(MessageError);

    try {
      await deleteMessage(mock.supabase, 'msg-1', 'staff-other');
    } catch (error) {
      expect((error as MessageError).code).toBe('MESSAGE_NOT_OWNED');
    }
  });

  it('admin은 타인 메시지도 삭제 가능', async () => {
    // admin=true이면 author_id eq가 없으므로 eq 1번만 호출
    mock.mockEq.mockReturnValue({
      select: () => ({ data: [{ id: 'msg-1' }], error: null }),
    });

    await expect(
      deleteMessage(mock.supabase, 'msg-1', 'admin-1', true),
    ).resolves.toBeUndefined();
  });

  it('DB 에러 시 MESSAGE_DELETE_FAILED', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: null, error: { message: 'db error' } }),
    });

    await expect(
      deleteMessage(mock.supabase, 'msg-1', 'staff-1'),
    ).rejects.toThrow(MessageError);

    try {
      await deleteMessage(mock.supabase, 'msg-1', 'staff-1');
    } catch (error) {
      expect((error as MessageError).code).toBe('MESSAGE_DELETE_FAILED');
    }
  });
});

describe('updateMessage', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('본인 메시지를 수정한다', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [{ id: 'msg-1' }], error: null }),
    });

    await expect(
      updateMessage(mock.supabase, 'msg-1', 'staff-1', false, { content: '수정됨' }),
    ).resolves.toBeUndefined();

    expect(mock.mockFrom).toHaveBeenCalledWith('messages');
    expect(mock.mockUpdate).toHaveBeenCalled();
  });

  it('타인 메시지 수정 시 MESSAGE_NOT_OWNED 에러', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [], error: null }),
    });

    await expect(
      updateMessage(mock.supabase, 'msg-1', 'staff-other', false, { content: '수정' }),
    ).rejects.toThrow(MessageError);

    try {
      await updateMessage(mock.supabase, 'msg-1', 'staff-other', false, { content: '수정' });
    } catch (error) {
      expect((error as MessageError).code).toBe('MESSAGE_NOT_OWNED');
    }
  });

  it('admin은 타인 메시지도 수정 가능', async () => {
    mock.mockEq.mockReturnValue({
      select: () => ({ data: [{ id: 'msg-1' }], error: null }),
    });

    await expect(
      updateMessage(mock.supabase, 'msg-1', 'admin-1', true, { content: '관리자 수정' }),
    ).resolves.toBeUndefined();
  });

  it('DB 에러 시 MESSAGE_UPDATE_FAILED', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: null, error: { message: 'db error' } }),
    });

    await expect(
      updateMessage(mock.supabase, 'msg-1', 'staff-1', false, { content: '수정' }),
    ).rejects.toThrow(MessageError);

    try {
      await updateMessage(mock.supabase, 'msg-1', 'staff-1', false, { content: '수정' });
    } catch (error) {
      expect((error as MessageError).code).toBe('MESSAGE_UPDATE_FAILED');
    }
  });
});

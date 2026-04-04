import { describe, it, expect, beforeEach } from 'vitest';
import { completeTask, TaskError } from './task';
import { createMockSupabase, type MockSupabaseChain } from '@/test-utils/supabase-mock';

describe('completeTask', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('정상적으로 task를 완료한다', async () => {
    // 1차 호출: maybeSingle → task_completion 존재 + is_completed: false
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: { id: 'tc-1', is_completed: false },
      error: null,
    });
    // 2차 호출: single → 업데이트 결과
    mock.mockSingle.mockReturnValueOnce({
      data: {
        id: 'tc-1',
        consultation_id: 'cons-1',
        is_completed: true,
        completed_at: '2026-04-04T00:00:00Z',
        memo: null,
      },
      error: null,
    });

    const result = await completeTask(mock.supabase, 'staff-1', 'coordinator', {
      consultation_id: 'cons-1',
    });

    expect(result.is_completed).toBe(true);
    expect(result.id).toBe('tc-1');
    expect(mock.mockFrom).toHaveBeenCalledWith('task_completions');
  });

  it('쿼리 에러 시 TASK_NOT_FOUND 에러', async () => {
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: null,
      error: { message: 'query failed' },
    });

    await expect(
      completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-1',
      }),
    ).rejects.toThrow(TaskError);

    try {
      mock.mockMaybeSingle.mockReturnValueOnce({
        data: null,
        error: { message: 'query failed' },
      });
      await completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-1',
      });
    } catch (error) {
      expect((error as TaskError).code).toBe('TASK_NOT_FOUND');
    }
  });

  it('존재하지 않는 task이면 TASK_NOT_FOUND 에러', async () => {
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: null,
      error: null,
    });

    await expect(
      completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-999',
      }),
    ).rejects.toThrow(TaskError);

    try {
      mock.mockMaybeSingle.mockReturnValueOnce({
        data: null,
        error: null,
      });
      await completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-999',
      });
    } catch (error) {
      expect((error as TaskError).code).toBe('TASK_NOT_FOUND');
    }
  });

  it('이미 완료된 task이면 TASK_ALREADY_COMPLETED 에러', async () => {
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: { id: 'tc-1', is_completed: true },
      error: null,
    });

    await expect(
      completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-1',
      }),
    ).rejects.toThrow(TaskError);

    try {
      mock.mockMaybeSingle.mockReturnValueOnce({
        data: { id: 'tc-1', is_completed: true },
        error: null,
      });
      await completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-1',
      });
    } catch (error) {
      expect((error as TaskError).code).toBe('TASK_ALREADY_COMPLETED');
    }
  });

  it('업데이트 실패 시 TASK_UPDATE_FAILED 에러', async () => {
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: { id: 'tc-1', is_completed: false },
      error: null,
    });
    mock.mockSingle.mockReturnValueOnce({
      data: null,
      error: { message: 'update failed' },
    });

    await expect(
      completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-1',
      }),
    ).rejects.toThrow(TaskError);

    try {
      mock.mockMaybeSingle.mockReturnValueOnce({
        data: { id: 'tc-1', is_completed: false },
        error: null,
      });
      mock.mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: 'update failed' },
      });
      await completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-1',
      });
    } catch (error) {
      expect((error as TaskError).code).toBe('TASK_UPDATE_FAILED');
    }
  });

  it('memo를 포함하여 task를 완료한다', async () => {
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: { id: 'tc-1', is_completed: false },
      error: null,
    });
    mock.mockSingle.mockReturnValueOnce({
      data: {
        id: 'tc-1',
        consultation_id: 'cons-1',
        is_completed: true,
        completed_at: '2026-04-04T00:00:00Z',
        memo: '투약 완료',
      },
      error: null,
    });

    const result = await completeTask(mock.supabase, 'staff-1', 'nurse', {
      consultation_id: 'cons-1',
      memo: '투약 완료',
    });

    expect(result.memo).toBe('투약 완료');
    expect(result.is_completed).toBe(true);
  });
});

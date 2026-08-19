import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NurseError, NurseErrorCode } from './error';
import { createMockSupabase, type MockSupabaseChain } from '@/test-utils/supabase-mock';

// ensureScheduleGenerated를 mock 처리
vi.mock('@/server/services/schedule', () => ({
  ensureScheduleGenerated: vi.fn().mockResolvedValue(undefined),
}));

// getTodayString을 mock 처리
vi.mock('@/lib/date', () => ({
  getTodayString: () => '2026-04-04',
  getMonthsAgoString: (m: number) => '2026-03-04',
}));

// 동적 import로 mock 이후에 로드
const {
  completeTask,
  createMessage,
  deleteMessage,
  updateMessage,
  getNursePatients,
} = await import('./service');

describe('nurse/getNursePatients', () => {
  it('당일 상태 조회 URL에 전체 환자 ID 목록을 넣지 않는다', async () => {
    const rowsByTable: Record<string, unknown[]> = {
      patients: [{
        id: 'p-1',
        name: '테스트 환자',
        display_name: null,
        avatar_url: null,
        gender: 'M',
        birth_date: null,
        coordinator: null,
      }],
      attendances: [
        { patient_id: 'p-1', checked_at: '2026-04-04T09:00:00Z' },
        { patient_id: 'inactive-patient', checked_at: '2026-04-04T09:00:00Z' },
      ],
      consultations: [{
        id: 'c-1',
        patient_id: 'p-1',
        note: null,
        has_task: false,
        task_content: null,
        task_target: null,
        staff: null,
        task_completions: [],
      }],
      scheduled_attendances: [{ patient_id: 'p-1' }],
    };

    const from = vi.fn((table: string) => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        returns: vi.fn(() => chain),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve(resolve({ data: rowsByTable[table] ?? [], error: null })),
      };
      return chain;
    });

    const result = await getNursePatients(
      { from } as unknown as Parameters<typeof getNursePatients>[0],
      { date: '2026-04-04', filter: 'all' },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.is_attended).toBe(true);
    expect(result[0]?.is_consulted).toBe(true);
    expect(result[0]?.is_scheduled).toBe(true);
  });
});

describe('nurse/completeTask', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('정상적으로 task를 완료하고 결과를 반환한다', async () => {
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
        memo: null,
      },
      error: null,
    });

    const result = await completeTask(mock.supabase, 'nurse-1', {
      consultation_id: 'cons-1',
    });

    expect(result.is_completed).toBe(true);
    expect(result.id).toBe('tc-1');
  });

  it('TaskError를 NurseError로 매핑한다 (TASK_NOT_FOUND)', async () => {
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: null,
      error: null,
    });

    try {
      await completeTask(mock.supabase, 'nurse-1', {
        consultation_id: 'cons-999',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(NurseError);
      expect((error as NurseError).code).toBe(NurseErrorCode.TASK_NOT_FOUND);
    }
  });

  it('TaskError를 NurseError로 매핑한다 (TASK_ALREADY_COMPLETED)', async () => {
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: { id: 'tc-1', is_completed: true },
      error: null,
    });

    try {
      await completeTask(mock.supabase, 'nurse-1', {
        consultation_id: 'cons-1',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(NurseError);
      expect((error as NurseError).code).toBe(NurseErrorCode.TASK_ALREADY_COMPLETED);
    }
  });
});

describe('nurse/createMessage', () => {
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
        content: '간호사 메시지',
        is_read: false,
        created_at: '2026-04-04T00:00:00Z',
      },
      error: null,
    });

    const result = await createMessage(mock.supabase, 'nurse-1', {
      patient_id: 'p-1',
      date: '2026-04-04',
      content: '간호사 메시지',
    });

    expect(result.id).toBe('msg-1');
    expect(result.content).toBe('간호사 메시지');
  });

  it('MessageError를 NurseError로 매핑한다', async () => {
    mock.mockSingle.mockReturnValueOnce({
      data: null,
      error: { message: 'insert failed' },
    });

    try {
      await createMessage(mock.supabase, 'nurse-1', {
        patient_id: 'p-1',
        date: '2026-04-04',
        content: '테스트',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(NurseError);
      expect((error as NurseError).code).toBe(NurseErrorCode.MESSAGE_SAVE_FAILED);
    }
  });
});

describe('nurse/deleteMessage', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('본인 메시지를 삭제한다', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [{ id: 'msg-1' }], error: null }),
    });

    await expect(
      deleteMessage(mock.supabase, 'nurse-1', 'msg-1'),
    ).resolves.toBeUndefined();
  });

  it('MessageError를 NurseError로 매핑한다', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [], error: null }),
    });

    try {
      await deleteMessage(mock.supabase, 'nurse-1', 'msg-1');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(NurseError);
      expect((error as NurseError).code).toBe(NurseErrorCode.MESSAGE_DELETE_FAILED);
    }
  });
});

describe('nurse/updateMessage', () => {
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
      updateMessage(mock.supabase, 'nurse-1', 'msg-1', '수정된 내용'),
    ).resolves.toBeUndefined();
  });

  it('MessageError를 NurseError로 매핑한다', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [], error: null }),
    });

    try {
      await updateMessage(mock.supabase, 'nurse-1', 'msg-1', '수정');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(NurseError);
      expect((error as NurseError).code).toBe(NurseErrorCode.MESSAGE_UPDATE_FAILED);
    }
  });
});

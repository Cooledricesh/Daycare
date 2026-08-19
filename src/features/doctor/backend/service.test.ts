import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DoctorError, DoctorErrorCode } from './error';
import { createMockSupabase, type MockSupabaseChain } from '@/test-utils/supabase-mock';

vi.mock('@/server/services/schedule', () => ({
  ensureScheduleGenerated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/date', () => ({
  getTodayString: () => '2026-04-04',
  getMonthsAgoString: (m: number) => '2026-03-04',
}));

const { createConsultation, markMessageRead, getPatientMessages, getWaitingPatients } = await import('./service');

describe('doctor/getWaitingPatients', () => {
  it('당일 상태 조회 URL에 전체 환자 ID 목록을 넣지 않는다', async () => {
    const rowsByTable: Record<string, unknown[]> = {
      patients: [{
        id: 'p-1',
        name: '테스트 환자',
        display_name: null,
        avatar_url: null,
        gender: 'M',
        birth_date: null,
        room_number: '3101',
        coordinator: null,
      }],
      attendances: [{ patient_id: 'p-1', checked_at: '2026-04-04T09:00:00Z' }],
      consultations: [{ id: 'c-1', patient_id: 'p-1', has_task: false, task_completions: [] }],
      messages: [],
      vitals: [],
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

    const result = await getWaitingPatients(
      { from } as unknown as Parameters<typeof getWaitingPatients>[0],
      { date: '2026-04-04' },
    );

    expect(result[0]?.has_consultation).toBe(true);
    expect(result[0]?.is_scheduled).toBe(true);
  });
});

describe('doctor/createConsultation', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('진찰 기록을 생성한다 (지시사항 없음)', async () => {
    // 1. 환자 존재 확인 → single
    mock.mockSingle
      .mockReturnValueOnce({
        data: { id: 'p-1', coordinator_id: 'coord-1' },
        error: null,
      })
      // 2. 출석 기록 확인 → single
      .mockReturnValueOnce({
        data: { id: 'att-1' },
        error: null,
      })
      // 3. upsert consultation → single
      .mockReturnValueOnce({
        data: {
          id: 'cons-1',
          patient_id: 'p-1',
          doctor_id: 'doc-1',
          date: '2026-04-04',
          note: '상태 양호',
          has_task: false,
          task_content: null,
          task_target: null,
          created_at: '2026-04-04T09:00:00Z',
        },
        error: null,
      });

    const result = await createConsultation(mock.supabase, 'doc-1', {
      patient_id: 'p-1',
      note: '상태 양호',
      has_task: false,
    });

    expect(result.id).toBe('cons-1');
    expect(result.patient_id).toBe('p-1');
    expect(result.note).toBe('상태 양호');
    expect(result.has_task).toBe(false);
  });

  it('환자가 존재하지 않으면 PATIENT_NOT_FOUND 에러', async () => {
    mock.mockSingle.mockReturnValueOnce({
      data: null,
      error: { message: 'not found' },
    });

    try {
      await createConsultation(mock.supabase, 'doc-1', {
        patient_id: 'p-999',
        note: '테스트',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DoctorError);
      expect((error as DoctorError).code).toBe(DoctorErrorCode.PATIENT_NOT_FOUND);
    }
  });

  it('출석 기록이 없으면 자동 생성 후 진찰 기록 생성', async () => {
    // 1. 환자 존재
    mock.mockSingle
      .mockReturnValueOnce({
        data: { id: 'p-1', coordinator_id: 'coord-1' },
        error: null,
      })
      // 2. 출석 기록 없음
      .mockReturnValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

    // insert (출석 생성) → chain 반환
    mock.mockInsert.mockReturnValueOnce({ error: null });

    // 3. upsert consultation → single
    mock.mockSingle.mockReturnValueOnce({
      data: {
        id: 'cons-2',
        patient_id: 'p-1',
        doctor_id: 'doc-1',
        date: '2026-04-04',
        note: '진찰 메모',
        has_task: false,
        task_content: null,
        task_target: null,
        created_at: '2026-04-04T09:00:00Z',
      },
      error: null,
    });

    const result = await createConsultation(mock.supabase, 'doc-1', {
      patient_id: 'p-1',
      note: '진찰 메모',
    });

    expect(result.id).toBe('cons-2');
  });

  it('진찰 기록 + 지시사항(coordinator) 생성', async () => {
    mock.mockSingle
      .mockReturnValueOnce({
        data: { id: 'p-1', coordinator_id: 'coord-1' },
        error: null,
      })
      .mockReturnValueOnce({
        data: { id: 'att-1' },
        error: null,
      })
      .mockReturnValueOnce({
        data: {
          id: 'cons-3',
          patient_id: 'p-1',
          doctor_id: 'doc-1',
          date: '2026-04-04',
          note: '투약 변경',
          has_task: true,
          task_content: '약 변경 확인',
          task_target: 'coordinator',
          created_at: '2026-04-04T09:00:00Z',
        },
        error: null,
      });

    const result = await createConsultation(mock.supabase, 'doc-1', {
      patient_id: 'p-1',
      note: '투약 변경',
      has_task: true,
      task_content: '약 변경 확인',
      task_target: 'coordinator',
    });

    expect(result.has_task).toBe(true);
    expect(result.task_content).toBe('약 변경 확인');
    expect(result.task_target).toBe('coordinator');
    // delete (기존 미완료 task 삭제) + insert (새 task_completion) 호출 확인
    expect(mock.mockDelete).toHaveBeenCalled();
    expect(mock.mockInsert).toHaveBeenCalled();
  });

  it('consultation upsert 실패 시 INVALID_REQUEST 에러', async () => {
    mock.mockSingle
      .mockReturnValueOnce({
        data: { id: 'p-1', coordinator_id: 'coord-1' },
        error: null,
      })
      .mockReturnValueOnce({
        data: { id: 'att-1' },
        error: null,
      })
      .mockReturnValueOnce({
        data: null,
        error: { message: 'upsert failed' },
      });

    try {
      await createConsultation(mock.supabase, 'doc-1', {
        patient_id: 'p-1',
        note: '테스트',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DoctorError);
      expect((error as DoctorError).code).toBe(DoctorErrorCode.INVALID_REQUEST);
    }
  });
});

describe('doctor/markMessageRead', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('메시지를 읽음 처리한다', async () => {
    mock.mockEq.mockReturnValue({
      ...mock.mockEq.getMockImplementation,
      error: null,
    });
    // update().eq() 체인 결과
    mock.setResult(null, null);

    const result = await markMessageRead(mock.supabase, {
      message_id: 'msg-1',
    });

    expect(result.success).toBe(true);
    expect(mock.mockFrom).toHaveBeenCalledWith('messages');
    expect(mock.mockUpdate).toHaveBeenCalled();
  });

  it('메시지가 없으면 MESSAGE_NOT_FOUND 에러', async () => {
    // update().eq() 체인에서 에러
    mock.mockEq.mockReturnValue({
      error: { message: 'not found' },
    });

    try {
      await markMessageRead(mock.supabase, {
        message_id: 'msg-999',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DoctorError);
      expect((error as DoctorError).code).toBe(DoctorErrorCode.MESSAGE_NOT_FOUND);
    }
  });
});

describe('doctor/getPatientMessages', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('환자별 전달사항 목록을 반환한다', async () => {
    mock.mockOrder.mockReturnValueOnce({
      data: [
        {
          id: 'msg-1',
          content: '메시지 1',
          is_read: false,
          author_role: 'coordinator',
          created_at: '2026-04-04T09:00:00Z',
          author: { name: '박코디' },
        },
        {
          id: 'msg-2',
          content: '메시지 2',
          is_read: true,
          author_role: 'nurse',
          created_at: '2026-04-04T10:00:00Z',
          author: { name: '김간호' },
        },
      ],
      error: null,
    });

    const result = await getPatientMessages(mock.supabase, {
      patient_id: 'p-1',
    });

    expect(result).toHaveLength(2);
    expect(result[0].author_name).toBe('박코디');
    expect(result[1].author_name).toBe('김간호');
  });

  it('쿼리 실패 시 INVALID_REQUEST 에러', async () => {
    mock.mockOrder.mockReturnValueOnce({
      data: null,
      error: { message: 'query failed' },
    });

    try {
      await getPatientMessages(mock.supabase, {
        patient_id: 'p-1',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DoctorError);
      expect((error as DoctorError).code).toBe(DoctorErrorCode.INVALID_REQUEST);
    }
  });

  it('메시지가 없으면 빈 배열을 반환한다', async () => {
    mock.mockOrder.mockReturnValueOnce({
      data: null,
      error: null,
    });

    const result = await getPatientMessages(mock.supabase, {
      patient_id: 'p-1',
    });

    expect(result).toEqual([]);
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/services/schedule', () => ({
  ensureScheduleGenerated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/date', () => ({
  getTodayString: () => '2026-04-04',
  getMonthsAgoString: () => '2026-03-04',
}));

const {
  getMyPatients,
  batchCreateAttendance,
  batchCancelAttendance,
  batchCreateConsultation,
  batchCancelConsultation,
} = await import('./service');

type BatchMode = 'create-attendance' | 'cancel-attendance' | 'create-consultation' | 'cancel-consultation';

function makePatientIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `patient-${String(index).padStart(3, '0')}`);
}

function makeBatchSupabase(mode: BatchMode, patientIds: string[]) {
  const inSizes: number[] = [];
  const insertedSizes: number[] = [];

  const from = vi.fn((table: string) => {
    let action: 'read' | 'insert' | 'delete' = 'read';
    let filteredIds: string[] = [];
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn((_column: string, ids: string[]) => {
        inSizes.push(ids.length);
        if (ids.length > 50) throw new Error(`oversized in filter: ${ids.length}`);
        filteredIds = ids;
        return chain;
      }),
      insert: vi.fn((rows: unknown[]) => {
        action = 'insert';
        insertedSizes.push(rows.length);
        return chain;
      }),
      delete: vi.fn(() => {
        action = 'delete';
        return chain;
      }),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
        let data: unknown[] = [];
        if (action === 'delete') {
          data = filteredIds.map((patient_id) => ({ patient_id }));
        } else if (action === 'read') {
          if (table === 'patients' && mode === 'create-consultation') {
            data = patientIds.map((id) => ({ id, doctor_id: 'doctor-1' }));
          } else if (table === 'attendances' && mode === 'create-consultation') {
            data = patientIds.map((patient_id) => ({ patient_id }));
          } else if (table === 'consultations' && mode === 'cancel-consultation') {
            data = patientIds.map((patient_id) => ({
              patient_id,
              checked_by_coordinator: true,
            }));
          }
        }
        return Promise.resolve(resolve({ data, error: null }));
      },
    };
    return chain;
  });

  return { supabase: { from }, inSizes, insertedSizes };
}

describe('staff/getMyPatients', () => {
  it('전체 보기에서도 당일 상태 조회 URL에 전체 환자 ID 목록을 넣지 않는다', async () => {
    const rowsByTable: Record<string, unknown[]> = {
      patients: [{
        id: 'p-1',
        name: '테스트 환자',
        display_name: null,
        avatar_url: null,
        gender: 'M',
        birth_date: null,
      }],
      attendances: [
        { patient_id: 'p-1', checked_at: '2026-04-04T09:00:00Z' },
        { patient_id: 'inactive-patient', checked_at: '2026-04-04T09:00:00Z' },
      ],
      consultations: [{
        patient_id: 'p-1',
        id: 'c-1',
        has_task: false,
        task_content: null,
        task_target: null,
        checked_by_coordinator: false,
        task_completions: [],
      }],
      messages: [{ id: 'm-1', patient_id: 'p-1', is_read: false }],
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

    const result = await getMyPatients(
      { from } as unknown as Parameters<typeof getMyPatients>[0],
      'coord-1',
      { date: '2026-04-04', show_all: 'true' },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.is_attended).toBe(true);
    expect(result[0]?.is_consulted).toBe(true);
    expect(result[0]?.is_scheduled).toBe(true);
    expect(result[0]?.unread_message_count).toBe(1);
  });
});

describe('staff 대량 일괄 처리', () => {
  const patientIds = makePatientIds(283);
  const request = { date: '2026-04-04', patient_ids: patientIds };

  it('전체 선택 출석 생성에서 긴 in(...) URL을 만들지 않는다', async () => {
    const mock = makeBatchSupabase('create-attendance', patientIds);
    const result = await batchCreateAttendance(
      mock.supabase as unknown as Parameters<typeof batchCreateAttendance>[0],
      request,
    );

    expect(result).toEqual({ created: 283, skipped: 0 });
    expect(mock.inSizes).toEqual([]);
    expect(mock.insertedSizes).toContain(283);
  });

  it('전체 선택 출석 취소의 삭제 필터를 50명 이하로 나눈다', async () => {
    const mock = makeBatchSupabase('cancel-attendance', patientIds);
    const result = await batchCancelAttendance(
      mock.supabase as unknown as Parameters<typeof batchCancelAttendance>[0],
      request,
    );

    expect(result.cancelled).toBe(283);
    expect(mock.inSizes).toEqual([50, 50, 50, 50, 50, 33]);
  });

  it('전체 선택 진찰 생성에서 긴 in(...) URL을 만들지 않는다', async () => {
    const mock = makeBatchSupabase('create-consultation', patientIds);
    const result = await batchCreateConsultation(
      mock.supabase as unknown as Parameters<typeof batchCreateConsultation>[0],
      request,
    );

    expect(result.created).toBe(283);
    expect(mock.inSizes).toEqual([]);
    expect(mock.insertedSizes).toContain(283);
  });

  it('전체 선택 진찰 취소의 삭제 필터를 50명 이하로 나눈다', async () => {
    const mock = makeBatchSupabase('cancel-consultation', patientIds);
    const result = await batchCancelConsultation(
      mock.supabase as unknown as Parameters<typeof batchCancelConsultation>[0],
      request,
    );

    expect(result.cancelled).toBe(283);
    expect(mock.inSizes).toEqual([50, 50, 50, 50, 50, 33]);
  });
});

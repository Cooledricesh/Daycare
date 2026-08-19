import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/services/schedule', () => ({
  ensureScheduleGenerated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/date', () => ({
  getTodayString: () => '2026-04-04',
  getMonthsAgoString: () => '2026-03-04',
}));

const { getMyPatients } = await import('./service');

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

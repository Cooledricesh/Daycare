import { describe, it, expect } from 'vitest';
import { computeTodayHighlights } from './service';

// Minimal mock Supabase client
function mockSupabase(tables: Record<string, unknown[]>) {
  return {
    from: (table: string) => ({
      select: () => ({
        gte: () => ({ lte: () => ({ data: tables[table] || [], error: null }) }),
        eq: () => ({ data: tables[table] || [], error: null }),
        order: () => ({ data: tables[table] || [], error: null }),
      }),
    }),
  };
}

describe('computeTodayHighlights', () => {
  const today = new Date('2026-04-11');

  it('오늘 생일인 환자를 birthdays에 포함', async () => {
    const supabase = mockSupabase({
      patients: [
        { id: 'p1', name: '홍길동', birth_date: '1974-04-11', display_name: null, avatar_url: null, room_number: '3101', status: 'active', created_at: '2025-01-01T00:00:00Z' },
        { id: 'p2', name: '이순신', birth_date: '1974-05-15', display_name: null, avatar_url: null, room_number: '3102', status: 'active', created_at: '2025-01-01T00:00:00Z' },
      ],
      attendances: [],
      scheduled_attendances: [],
      consultations: [],
    });

    const result = await computeTodayHighlights(supabase as any, today);

    expect(result.events.birthdays).toHaveLength(1);
    expect(result.events.birthdays[0].id).toBe('p1');
  });

  it('오늘 등록된 환자를 newlyRegistered에 포함', async () => {
    const supabase = mockSupabase({
      patients: [
        { id: 'p3', name: '김철수', birth_date: null, created_at: '2026-04-11T09:00:00Z', display_name: null, avatar_url: null, room_number: null, status: 'active' },
      ],
      attendances: [],
      scheduled_attendances: [],
      consultations: [],
    });

    const result = await computeTodayHighlights(supabase as any, today);
    expect(result.events.newlyRegistered.some((p) => p.id === 'p3')).toBe(true);
  });

  it('아무 이벤트도 없으면 모든 배열이 빈 배열', async () => {
    const supabase = mockSupabase({
      patients: [],
      attendances: [],
      scheduled_attendances: [],
      consultations: [],
    });
    const result = await computeTodayHighlights(supabase as any, today);
    expect(result.events.threeDayAbsence).toEqual([]);
    expect(result.events.suddenAbsence).toEqual([]);
    expect(result.events.examMissed).toEqual([]);
    expect(result.events.birthdays).toEqual([]);
    expect(result.events.newlyRegistered).toEqual([]);
  });
});

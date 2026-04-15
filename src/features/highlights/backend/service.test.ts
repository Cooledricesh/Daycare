import { describe, it, expect } from 'vitest';
import { computeTodayHighlights } from './service';

// Minimal mock Supabase client. supports both:
// - 단일 쿼리 체인 (.eq → data)
// - fetchAllPaginated 체인 (.gte().lte().order().range() → data)
function mockSupabase(tables: Record<string, unknown[]>) {
  const makePaginatedTerminal = (rows: unknown[]) => {
    const terminal = {
      data: rows,
      error: null,
      range: (_from: number, _to: number) => Promise.resolve({ data: rows, error: null }),
      order: () => terminal,
    };
    return terminal;
  };

  return {
    from: (table: string) => {
      const rows = tables[table] || [];
      const terminal = makePaginatedTerminal(rows);
      return {
        select: () => ({
          gte: () => ({ lte: () => terminal }),
          eq: () => terminal,
          order: () => terminal,
        }),
      };
    },
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

  // 진찰 종료 시각 KST 12시 컷오프 — 그 이전엔 결석/누락 카드가 비어야 한다.
  // KST 정오 = UTC 03:00. UTC 02:00은 KST 11:00 (정오 이전)
  it('정오 이전(KST)에는 suddenAbsence/examMissed가 비어야 한다', async () => {
    const beforeNoonKst = new Date('2026-04-11T02:00:00Z'); // KST 11:00
    const supabase = mockSupabase({
      patients: [
        { id: 'p1', name: '오기용', birth_date: null, display_name: null, avatar_url: null, room_number: '3101', status: 'active', created_at: '2025-01-01T00:00:00Z' },
      ],
      // 14일 전부 예정+출석 → 평소 개근자 (정상이면 suddenAbsence 후보)
      attendances: Array.from({ length: 9 }, (_, i) => ({ patient_id: 'p1', date: `2026-04-${String(i + 1).padStart(2, '0')}` })),
      scheduled_attendances: Array.from({ length: 11 }, (_, i) => ({ patient_id: 'p1', date: `2026-04-${String(i + 1).padStart(2, '0')}`, is_cancelled: false })),
      consultations: [],
    });
    const result = await computeTodayHighlights(supabase as any, beforeNoonKst);
    expect(result.events.suddenAbsence).toEqual([]);
    expect(result.events.examMissed).toEqual([]);
    expect(result.events.threeDayAbsence).toEqual([]);
  });

  // UTC 04:00 = KST 13:00 (정오 이후) → suddenAbsence 평가됨
  // 14일 중 10일 예정+출석 (출석률 100%), 오늘(4/11) 예정인데 결석 → suddenAbsence
  it('정오 이후(KST)에는 평소 개근자가 오늘 결석이면 suddenAbsence에 포함', async () => {
    const afterNoonKst = new Date('2026-04-11T04:00:00Z'); // KST 13:00
    const pastDates = Array.from({ length: 10 }, (_, i) => `2026-04-${String(i + 1).padStart(2, '0')}`);
    const supabase = mockSupabase({
      patients: [
        { id: 'p1', name: '오기용', birth_date: null, display_name: null, avatar_url: null, room_number: '3101', status: 'active', created_at: '2025-01-01T00:00:00Z' },
      ],
      attendances: pastDates.map((date) => ({ patient_id: 'p1', date })),
      // 오늘(4/11) 추가 예정 → 출석률 10/11 ≈ 0.909 (>= 0.9), 오늘 결석
      scheduled_attendances: [...pastDates, '2026-04-11'].map((date) => ({ patient_id: 'p1', date, is_cancelled: false })),
      consultations: [],
    });
    const result = await computeTodayHighlights(supabase as any, afterNoonKst);
    expect(result.events.suddenAbsence.some((p) => p.id === 'p1')).toBe(true);
  });
});

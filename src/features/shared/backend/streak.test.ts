import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectClosureDates,
  calculateConsecutiveAttendance,
} from './streak';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

describe('detectClosureDates', () => {
  it('평일인데 전체 출석자 0명인 날을 휴원으로 감지한다', () => {
    // 2026-06-04(목),06-05(금),06-08(월) 출석. 06-03(수)는 전원 미출석=휴원.
    const attended = new Set(['2026-06-04', '2026-06-05', '2026-06-08']);
    const closures = detectClosureDates(attended, '2026-06-01', '2026-06-08');
    expect(closures.has('2026-06-03')).toBe(true); // 수요일 휴원
    expect(closures.has('2026-06-02')).toBe(true); // 화요일도 출석기록 없음 → 휴원 취급
  });

  it('endDate(오늘)는 휴원으로 감지하지 않는다', () => {
    const attended = new Set<string>();
    const closures = detectClosureDates(attended, '2026-06-08', '2026-06-08');
    expect(closures.has('2026-06-08')).toBe(false);
  });

  it('주말은 휴원으로 감지하지 않는다', () => {
    const attended = new Set<string>();
    const closures = detectClosureDates(attended, '2026-06-06', '2026-06-08');
    expect(closures.has('2026-06-06')).toBe(false); // 토
    expect(closures.has('2026-06-07')).toBe(false); // 일
  });
});

// ---------------------------------------------------------------------------
// getStreaksMapCached 테스트
// ---------------------------------------------------------------------------

const END_DATE = '2026-06-10';
const PATIENTS = [{ id: 'p1', created_at: '2026-01-01T00:00:00Z' }];

/** TTL 이내 캐시 히트용 computed_at: 현재 시각 기준 1분 전 */
function freshComputedAt(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

/** TTL 초과 캐시 만료용 computed_at: 현재 시각 기준 10분 전 */
function staleComputedAt(): string {
  return new Date(Date.now() - 10 * 60_000).toISOString();
}

const SAMPLE_PAYLOAD = {
  p1: { attendance_streak: 3, consultation_streak: 2, streak_tier: 'fire' },
};

/**
 * fetchAllPaginated 경로까지 지원하는 완전한 supabase mock 빌더.
 *
 * streaks_cache: select → eq → eq → single, upsert
 * 다른 테이블(attendances 등): select → gte/eq → lte → order → range(빈 배열 반환)
 *
 * ES module live binding 제약으로 getStreaksMap을 vi.spyOn으로 mock하기 어려우므로,
 * 재계산 경로에서는 supabase mock이 빈 데이터를 반환해 스트릭 0 결과를 만든다.
 */
function buildFullSupabase({
  singleResult,
  upsertFn = vi.fn().mockResolvedValue({ error: null }),
}: {
  singleResult: { data: unknown; error: null };
  upsertFn?: ReturnType<typeof vi.fn>;
}): { supabase: SupabaseClient<Database>; upsertFn: ReturnType<typeof vi.fn> } {
  // fetchAllPaginated 체인: .select(...).gte(...).lte(...).order(...).range(...)
  //                          .select(...).eq(...).order(...).range(...)
  const rangeFn = vi.fn().mockResolvedValue({ data: [], error: null });
  const orderForRange = vi.fn().mockReturnValue({ range: rangeFn });
  const lteFn = vi.fn().mockReturnValue({ order: orderForRange });
  const gteFn = vi.fn().mockReturnValue({ lte: lteFn, order: orderForRange });
  // holidays: .gte(...).lte(...) 체인을 Promise resolve로 처리
  const eqForPatterns = vi.fn().mockReturnValue({ order: orderForRange });
  const innerSelectFn = vi.fn().mockReturnValue({
    gte: gteFn,
    eq: eqForPatterns,
    order: orderForRange,
  });

  // streaks_cache 체인: .select(...).eq('cache_date', endDate).single()
  const singleFn = vi.fn().mockResolvedValue(singleResult);
  const cacheEqFn = vi.fn().mockReturnValue({ single: singleFn });
  const cacheSelectFn = vi.fn().mockReturnValue({ eq: cacheEqFn });

  const fromFn = vi.fn((table: string) => {
    if (table === 'streaks_cache') {
      return { select: cacheSelectFn, upsert: upsertFn };
    }
    return { select: innerSelectFn };
  });

  return {
    supabase: { from: fromFn } as unknown as SupabaseClient<Database>,
    upsertFn,
  };
}

/**
 * 캐시 조회만 throw하는 supabase mock (fallback 검증용).
 * 다른 테이블 경로도 fetchAllPaginated 체인을 지원해야 한다.
 */
function buildCacheErrorSupabase(): {
  supabase: SupabaseClient<Database>;
  upsertFn: ReturnType<typeof vi.fn>;
} {
  const rangeFn = vi.fn().mockResolvedValue({ data: [], error: null });
  const orderForRange = vi.fn().mockReturnValue({ range: rangeFn });
  const lteFn = vi.fn().mockReturnValue({ order: orderForRange });
  const gteFn = vi.fn().mockReturnValue({ lte: lteFn, order: orderForRange });
  const eqForPatterns = vi.fn().mockReturnValue({ order: orderForRange });
  const innerSelectFn = vi.fn().mockReturnValue({
    gte: gteFn,
    eq: eqForPatterns,
    order: orderForRange,
  });

  const upsertFn = vi.fn().mockResolvedValue({ error: null });
  const singleFn = vi.fn().mockRejectedValue(new Error('DB connection error'));
  const cacheEqFn = vi.fn().mockReturnValue({ single: singleFn });
  const cacheSelectFn = vi.fn().mockReturnValue({ eq: cacheEqFn });

  const fromFn = vi.fn((table: string) => {
    if (table === 'streaks_cache') {
      return { select: cacheSelectFn, upsert: upsertFn };
    }
    return { select: innerSelectFn };
  });

  return {
    supabase: { from: fromFn } as unknown as SupabaseClient<Database>,
    upsertFn,
  };
}

describe('getStreaksMapCached', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('캐시 히트(TTL 이내) — streaks_cache 이외 테이블 미조회, payload 반환', async () => {
    const { getStreaksMapCached } = await import('./streak');

    const { supabase, upsertFn } = buildFullSupabase({
      singleResult: {
        data: { payload: SAMPLE_PAYLOAD, computed_at: freshComputedAt() },
        error: null,
      },
    });

    const result = await getStreaksMapCached(supabase, END_DATE, PATIENTS);

    expect(result.get('p1')?.attendance_streak).toBe(3);
    expect(result.get('p1')?.consultation_streak).toBe(2);
    // upsert 미실행: 캐시 히트이므로 재저장 불필요
    expect(upsertFn).not.toHaveBeenCalled();
    // attendances 등 다른 테이블 미조회: from이 streaks_cache로만 호출됨
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(fromCalls.every((t: unknown) => t === 'streaks_cache')).toBe(true);
  });

  it('캐시 만료 — 재계산 + upsert 실행', async () => {
    const { getStreaksMapCached } = await import('./streak');

    const { supabase, upsertFn } = buildFullSupabase({
      singleResult: {
        data: { payload: SAMPLE_PAYLOAD, computed_at: staleComputedAt() },
        error: null,
      },
    });

    const result = await getStreaksMapCached(supabase, END_DATE, PATIENTS);

    // 재계산 결과: mock이 빈 출석 데이터를 반환하므로 streak 0
    expect(result.get('p1')?.attendance_streak).toBe(0);
    // upsert 실행 확인
    expect(upsertFn).toHaveBeenCalledOnce();
    // upsert payload에 cache_date 포함 확인
    expect(upsertFn.mock.calls[0][0]).toMatchObject({ cache_date: END_DATE });
  });

  it('캐시 미스(row 없음) — 재계산 + upsert 실행', async () => {
    const { getStreaksMapCached } = await import('./streak');

    const { supabase, upsertFn } = buildFullSupabase({
      singleResult: { data: null, error: null },
    });

    const result = await getStreaksMapCached(supabase, END_DATE, PATIENTS);

    // 재계산 결과: mock이 빈 출석 데이터를 반환하므로 streak 0
    expect(result.get('p1')?.attendance_streak).toBe(0);
    expect(upsertFn).toHaveBeenCalledOnce();
    expect(upsertFn.mock.calls[0][0]).toMatchObject({ cache_date: END_DATE });
  });

  it('캐시 조회 에러 — 재계산으로 fallback, 요청 실패 없음', async () => {
    const { getStreaksMapCached } = await import('./streak');
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { supabase } = buildCacheErrorSupabase();

    const result = await getStreaksMapCached(supabase, END_DATE, PATIENTS);

    // 예외 없이 Map 반환: fallback으로 재계산
    expect(result).toBeInstanceOf(Map);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('캐시 조회 실패'));
  });
});

describe('calculateConsecutiveAttendance — 휴원일 건너뛰기', () => {
  const patternDows = new Set([1, 2, 3, 4, 5]); // 평일 패턴
  const empty = new Set<string>();
  const created = '2026-01-01';

  it('휴원일(holiday)이 등록되면 스트릭이 그날을 건너뛰어 이어진다', () => {
    // 06-08(월),06-05(금),06-04(목) 출석. 06-03(수)=휴원. 06-02(화),06-01(월) 출석.
    const attended = new Set(['2026-06-08', '2026-06-05', '2026-06-04', '2026-06-02', '2026-06-01']);
    const holidays = new Map<string, string>([['2026-06-03', '지방선거']]);
    const streak = calculateConsecutiveAttendance(
      empty, empty, patternDows, attended, created, holidays, '2026-06-08',
    );
    // 06-08,05,04 + (06-03 skip) + 06-02,01 = 5
    expect(streak).toBe(5);
  });

  it('휴원일이 등록되지 않으면 그 평일에서 스트릭이 끊긴다 (버그 재현)', () => {
    const attended = new Set(['2026-06-08', '2026-06-05', '2026-06-04', '2026-06-02', '2026-06-01']);
    const noHolidays = new Map<string, string>();
    const streak = calculateConsecutiveAttendance(
      empty, empty, patternDows, attended, created, noHolidays, '2026-06-08',
    );
    // 06-08,05,04 까지 후 06-03(수, 평일, 예정, 미출석)에서 break = 3
    expect(streak).toBe(3);
  });
});

import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Supabase PostgREST 기본 서버 설정(`db-max-rows=1000`)으로 인한 row 절단을 회피하기 위한 페이지네이션 헬퍼.
 *
 * 60일치 attendances(4000+행), scheduled_attendances(9000+행) 같은 대량 쿼리는 단일 요청으로는
 * silent하게 1000행에서 잘리므로 이 헬퍼로 1000행 단위 페이지 순회가 필요하다.
 *
 * 안정적 페이지 경계 보장을 위해 `buildQuery`가 반환하는 쿼리에는 반드시 unique 컬럼 기준 order가 걸려있어야 한다.
 */
const DEFAULT_PAGE_SIZE = 1000;

export type RangeableQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
};

export async function fetchAllPaginated<T>(
  buildQuery: () => RangeableQuery<T>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

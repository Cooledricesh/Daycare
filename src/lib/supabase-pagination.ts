import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Supabase PostgREST 기본 서버 설정(`db-max-rows=1000`)으로 인한 row 절단을 회피하기 위한 페이지네이션 헬퍼.
 *
 * 60일치 attendances(4000+행), scheduled_attendances(9000+행) 같은 대량 쿼리는 단일 요청으로는
 * silent하게 1000행에서 잘리므로 이 헬퍼로 1000행 단위 페이지 순회가 필요하다.
 *
 * 안정적 페이지 경계 보장을 위해 `buildQuery`가 반환하는 쿼리에는 반드시 unique 컬럼 기준 order가 걸려있어야 한다.
 *
 * 병렬화 전략 (wave 방식):
 * - 한 wave에 PARALLEL_PAGE_WAVE_SIZE 개 페이지를 Promise.all로 병렬 요청한다.
 * - wave 내 어떤 페이지가 pageSize 미만 행을 반환하면, 그 페이지까지의 데이터만 취하고 종료한다.
 * - 모든 페이지가 가득 찼으면 다음 wave를 실행한다.
 * - wave 안에서 부분 페이지 이후의 페이지 데이터는 버린다 (순서 보장).
 */
const DEFAULT_PAGE_SIZE = 1000;

/** 한 wave에서 병렬로 요청할 페이지 수 */
const PARALLEL_PAGE_WAVE_SIZE = 5;

export type RangeableQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
};

export async function fetchAllPaginated<T>(
  buildQuery: () => RangeableQuery<T>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  let waveStart = 0;

  while (true) {
    // 현재 wave에서 병렬로 요청할 페이지 인덱스 배열 생성
    const pageOffsets = Array.from(
      { length: PARALLEL_PAGE_WAVE_SIZE },
      (_, i) => waveStart + i * pageSize,
    );

    // wave 내 모든 페이지를 병렬 요청
    const results = await Promise.all(
      pageOffsets.map((from) => buildQuery().range(from, from + pageSize - 1)),
    );

    // 에러 확인 (첫 번째 에러를 throw)
    for (const result of results) {
      if (result.error) throw result.error;
    }

    // 순서대로 처리: 부분 페이지 이후 데이터는 버림
    let done = false;
    for (const result of results) {
      const rows = result.data ?? [];
      if (rows.length === 0) {
        // 빈 페이지: 이후 페이지는 모두 버리고 종료
        done = true;
        break;
      }
      all.push(...rows);
      if (rows.length < pageSize) {
        // 부분 페이지: 데이터를 포함하되 이후 페이지는 버리고 종료
        done = true;
        break;
      }
    }

    if (done) break;

    // 모든 페이지가 가득 찼으면 다음 wave로
    waveStart += PARALLEL_PAGE_WAVE_SIZE * pageSize;
  }

  return all;
}

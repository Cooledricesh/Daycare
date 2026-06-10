import { describe, it, expect, vi } from 'vitest';
import { fetchAllPaginated } from './supabase-pagination';
import type { RangeableQuery } from './supabase-pagination';

/** buildQuery 팩토리: 주어진 rows 배열을 range 요청에 따라 슬라이싱해 반환 */
function makeQuery<T>(rows: T[]): () => RangeableQuery<T> {
  return () => ({
    range: (from: number, to: number) =>
      Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
  });
}

/** 에러를 반환하는 buildQuery 팩토리 */
function makeErrorQuery<T>(message: string): () => RangeableQuery<T> {
  return () => ({
    range: () =>
      Promise.resolve({
        data: null,
        error: { message, details: '', hint: '', code: 'PGRST' } as never,
      }),
  });
}

describe('fetchAllPaginated — 기본 동작', () => {
  it('(1) 행이 pageSize 미만이면 1번의 wave로 모두 반환한다', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const result = await fetchAllPaginated(makeQuery(rows), 1000);
    expect(result).toHaveLength(5);
    expect(result).toEqual(rows);
  });

  it('(2) 정확히 pageSize 경계인 경우 다음 wave에서 빈 페이지를 받고 종료한다', async () => {
    // pageSize=10, 총 10행 → 첫 번째 페이지가 꽉 찬 후 두 번째 페이지는 빈 배열
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const result = await fetchAllPaginated(makeQuery(rows), 10);
    expect(result).toHaveLength(10);
    expect(result).toEqual(rows);
  });

  it('(3) 여러 wave에 걸친 케이스를 모두 수집한다', async () => {
    // PARALLEL_PAGE_WAVE_SIZE=5, pageSize=10 → wave당 50행
    // 총 130행 → 3번째 wave에서 종료
    const rows = Array.from({ length: 130 }, (_, i) => ({ id: i }));
    const result = await fetchAllPaginated(makeQuery(rows), 10);
    expect(result).toHaveLength(130);
    expect(result[0]).toEqual({ id: 0 });
    expect(result[129]).toEqual({ id: 129 });
  });

  it('(4) 쿼리가 에러를 반환하면 throw한다', async () => {
    await expect(
      fetchAllPaginated(makeErrorQuery('DB 연결 오류'), 1000),
    ).rejects.toMatchObject({ message: 'DB 연결 오류' });
  });

  it('(5) 부분 페이지 이후 페이지 데이터는 포함하지 않는다', async () => {
    // pageSize=10, 총 25행 → [0-9], [10-19], [20-24] (부분), [25+] (빈)
    // wave 1: 페이지0(10행), 페이지1(10행), 페이지2(5행-부분) → 페이지3,4 데이터 버림
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: i }));

    // buildQuery 호출 횟수 추적
    let callCount = 0;
    const buildQuery = (): RangeableQuery<{ id: number }> => {
      callCount++;
      return {
        range: (from: number, to: number) =>
          Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
      };
    };

    const result = await fetchAllPaginated(buildQuery, 10);
    expect(result).toHaveLength(25);
    expect(result[24]).toEqual({ id: 24 });
    // wave 1에서 5페이지 병렬 요청 (0,10,20,30,40 시작점)
    // 페이지2(from=20)가 부분 → 페이지3,4 결과는 버려야 함 (data는 빈 배열)
    // 실제 buildQuery는 5번 호출됨 (wave 1개)
    expect(callCount).toBe(5);
  });

  it('(5b) wave 내 중간 부분 페이지 이후 데이터가 수집되지 않는다', async () => {
    // pageSize=10, 총 35행
    // wave 1: 페이지0(10), 페이지1(10), 페이지2(10), 페이지3(5-부분), 페이지4(빈)
    // 페이지3까지만 포함, 페이지4 이후 버림
    const rows = Array.from({ length: 35 }, (_, i) => ({ id: i }));
    const result = await fetchAllPaginated(makeQuery(rows), 10);
    expect(result).toHaveLength(35);
    expect(result[34]).toEqual({ id: 34 });
  });

  it('빈 결과셋이면 빈 배열을 반환한다', async () => {
    const result = await fetchAllPaginated(makeQuery([]), 1000);
    expect(result).toEqual([]);
  });

  it('정확히 wave 경계(WAVE_SIZE * pageSize)에서 끊기는 경우', async () => {
    // PARALLEL_PAGE_WAVE_SIZE=5, pageSize=10 → wave당 50행
    // 총 50행 → wave 1에서 5페이지 모두 꽉 참 → wave 2 실행 → 첫 페이지 빈 배열 → 종료
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const result = await fetchAllPaginated(makeQuery(rows), 10);
    expect(result).toHaveLength(50);
    expect(result[49]).toEqual({ id: 49 });
  });
});

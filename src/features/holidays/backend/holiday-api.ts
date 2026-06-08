/**
 * 행정안전부 특일정보(getRestDeInfo) 연동.
 * 공공데이터포털: https://www.data.go.kr/data/15012690/openapi.do
 */

const REST_DE_INFO_URL =
  'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const REQUEST_TIMEOUT_MS = 8000;

export type HolidayRecord = { date: string; reason: string };

/** API item 1건 (getRestDeInfo) */
type RestDeItem = {
  dateName?: string;
  isHoliday?: string;
  locdate?: number | string;
};

/** locdate(20260101 | "20260101") → "2026-01-01" */
function toIsoDate(locdate: number | string): string | null {
  const s = String(locdate).trim();
  if (!/^\d{8}$/u.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * getRestDeInfo 응답(JSON)의 body.items.item 을 정규화하여 공휴일 레코드로 변환.
 * - item 은 배열 / 단일 객체 / 빈 문자열 / undefined 모두 가능 → 정규화
 * - isHoliday === 'Y' 인 것만 채택
 * 순수 함수(테스트 대상).
 */
export function parseRestDeItems(body: unknown): HolidayRecord[] {
  const item = (body as { response?: { body?: { items?: { item?: unknown } } } })
    ?.response?.body?.items?.item;

  const list: RestDeItem[] = Array.isArray(item)
    ? (item as RestDeItem[])
    : item && typeof item === 'object'
      ? [item as RestDeItem]
      : [];

  const result: HolidayRecord[] = [];
  for (const it of list) {
    if (it.isHoliday !== 'Y' || it.locdate === undefined) continue;
    const date = toIsoDate(it.locdate);
    if (!date) continue;
    result.push({ date, reason: (it.dateName ?? '공휴일').trim() });
  }
  return result;
}

/** 단일 (연,월) 공휴일 조회 */
async function fetchMonth(
  serviceKey: string,
  year: number,
  month: number,
): Promise<HolidayRecord[]> {
  const url = new URL(REST_DE_INFO_URL);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('solYear', String(year));
  url.searchParams.set('solMonth', String(month).padStart(2, '0'));
  url.searchParams.set('numOfRows', '100');
  url.searchParams.set('_type', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`특일정보 API HTTP ${res.status} (${year}-${month})`);
    }
    const body = (await res.json()) as unknown;
    return parseRestDeItems(body);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 주어진 연도들의 공휴일 전체를 조회 (월별 1~12 순회).
 * 날짜 기준 중복 제거.
 */
export async function fetchHolidaysForYears(
  serviceKey: string,
  years: number[],
): Promise<HolidayRecord[]> {
  const byDate = new Map<string, HolidayRecord>();
  for (const year of years) {
    for (let month = 1; month <= 12; month++) {
      const records = await fetchMonth(serviceKey, year, month);
      for (const r of records) byDate.set(r.date, r);
    }
  }
  return Array.from(byDate.values());
}

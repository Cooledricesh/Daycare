import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { fetchHolidaysForYears, type HolidayRecord } from './holiday-api';

export type HolidaySyncResult = {
  years: number[];
  fetched: number;
  upserted: number;
};

/**
 * 지정 연도들의 공휴일을 특일정보 API에서 가져와 holidays 테이블에 upsert.
 * - date 기준 충돌 시 reason/updated_at 갱신
 */
export async function syncHolidays(
  supabase: SupabaseClient<Database>,
  serviceKey: string,
  years: number[],
): Promise<HolidaySyncResult> {
  const records: HolidayRecord[] = await fetchHolidaysForYears(serviceKey, years);

  if (records.length === 0) {
    return { years, fetched: 0, upserted: 0 };
  }

  const rows = records.map((r) => ({
    date: r.date,
    reason: r.reason,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('holidays')
    .upsert(rows, { onConflict: 'date' });

  if (error) {
    throw new Error(`holidays upsert 실패: ${error.message}`);
  }

  return { years, fetched: records.length, upserted: rows.length };
}

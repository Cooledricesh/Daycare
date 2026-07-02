import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * 날짜 문자열(yyyy-MM-dd)이 주말인지 확인합니다.
 */
export function isWeekend(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

/**
 * 기간 내 공휴일을 Map<date, reason>으로 반환합니다.
 */
export async function getHolidayDatesMap(
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string,
): Promise<Map<string, string>> {
  const { data } = await supabase.from('holidays')
    .select('date, reason')
    .gte('date', startDate)
    .lte('date', endDate);

  const map = new Map<string, string>();
  (data || []).forEach((h) => {
    map.set(h.date, h.reason);
  });
  return map;
}

/**
 * 기간 내 휴진일(진찰 없는 날) 날짜를 Set<yyyy-MM-dd>으로 반환합니다.
 * 공휴일과 달리 출석 지표에는 영향을 주지 않고 진찰 지표에서만 제외하는 용도.
 */
export async function getClinicClosureDatesSet(
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string,
): Promise<Set<string>> {
  const { data } = await supabase.from('clinic_closures')
    .select('date')
    .gte('date', startDate)
    .lte('date', endDate);

  return new Set((data || []).map((r) => r.date));
}

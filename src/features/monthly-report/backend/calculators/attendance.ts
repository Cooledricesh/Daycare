import type { SupabaseClient } from '@supabase/supabase-js';
import {
  eachDayOfInterval,
  isWeekend,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
} from 'date-fns';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

/**
 * 모든 페이지를 순회하여 전체 데이터를 가져옵니다 (Supabase 1000행 캡 우회)
 */
async function fetchAllWithPagination<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;

  while (true) {
    const page = await fetchPage(from, from + pageSize - 1);
    results.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return results;
}

/**
 * 해당 월의 공휴일 날짜 목록을 가져옵니다
 */
export async function getHolidayDates(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<Set<string>> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('holidays')
    .select('date')
    .gte('date', monthStart)
    .lte('date', monthEnd);

  if (error) throw new Error(`공휴일 조회 실패: ${error.message}`);

  return new Set((data ?? []).map((h) => h.date));
}

/**
 * 해당 월의 영업일 수 (평일 - 공휴일) 를 계산합니다
 */
export async function getWorkingDaysCount(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<{ workingDays: number; holidayDates: Set<string> }> {
  const holidayDates = await getHolidayDates(supabase, year, month);

  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const workingDays = allDays.filter((day) => {
    if (isWeekend(day)) return false;
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return !holidayDates.has(dateStr);
  }).length;

  return { workingDays, holidayDates };
}

/**
 * 월 총 출석일수를 계산합니다 (spec §4.1)
 */
export async function calculateTotalAttendanceDays(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<number> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const { count, error } = await supabase
    .from('attendances')
    .select('*', { count: 'exact', head: true })
    .gte('date', monthStart)
    .lt('date', nextMonth);

  if (error) throw new Error(`출석일수 조회 실패: ${error.message}`);

  return count ?? 0;
}

/**
 * 월말 기준 등록 환자 수를 계산합니다 (spec §4.2)
 *
 * 과거 월: `daily_stats.registered_count` 의 월 내 마지막 스냅샷 값을 사용합니다.
 *          스냅샷이 없으면 현재 active 환자 수로 폴백합니다.
 * 현재 월: daily_stats 최신 값 또는 현재 active 환자 수.
 */
export async function getRegisteredCountEom(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<number> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const { data: stats, error: statsError } = await supabase
    .from('daily_stats')
    .select('registered_count')
    .gte('date', monthStart)
    .lt('date', nextMonth)
    .gt('registered_count', 0)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (statsError) throw new Error(`월말 등록 환자 수 조회 실패: ${statsError.message}`);

  if (stats?.registered_count) {
    return stats.registered_count;
  }

  // 폴백: 현재 active 환자 수
  const { count, error } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  if (error) throw new Error(`등록 환자 수 조회 실패: ${error.message}`);

  return count ?? 0;
}

/**
 * 1인당 월평균 출석일수를 계산합니다 (spec §4.2)
 */
export function calculatePerPatientAvgDays(
  totalAttendanceDays: number,
  registeredCountEom: number,
): number {
  if (registeredCountEom === 0) return 0;
  return Math.round((totalAttendanceDays / registeredCountEom) * 100) / 100;
}

/**
 * 일평균 출석 인원을 계산합니다 (spec §4.3)
 */
export function calculateDailyAvgAttendance(
  totalAttendanceDays: number,
  workingDays: number,
): number {
  if (workingDays === 0) return 0;
  return Math.round((totalAttendanceDays / workingDays) * 100) / 100;
}

/**
 * 해당 월에 등록된 신규 환자 수를 계산합니다
 */
export async function getNewPatientCount(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<number> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const rows = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('patients')
      .select('id')
      .gte('created_at', monthStart)
      .lt('created_at', nextMonth)
      .range(from, to);

    if (error) throw new Error(`신규 환자 수 조회 실패: ${error.message}`);
    return data ?? [];
  });

  return rows.length;
}

export { fetchAllWithPagination };

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  eachDayOfInterval,
  isWeekend,
  startOfMonth,
  endOfMonth,
  getWeek,
  format,
} from 'date-fns';
import type { Database } from '@/lib/supabase/types';
import type {
  WeeklyTrendEntry,
  WeekdayAvg,
  PrevMonthComparison,
  MonthlyReportResponse,
} from '../schema';
import { fetchAllWithPagination, getHolidayDates } from './attendance';

type Supabase = SupabaseClient<Database>;

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 반환합니다
 */
function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * 월 내 주차별 추이를 계산합니다 (spec §2.2 weekly_trend)
 * 주차: 해당 월 기준으로 1~6주차 (월 내 달력 주)
 */
export async function calculateWeeklyTrend(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<WeeklyTrendEntry[]> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const monthStartStr = formatDate(monthStart);
  const monthEndStr = formatDate(monthEnd);

  const holidayDates = await getHolidayDates(supabase, year, month);

  // 해당 월 전체 출석 데이터 로드 (1000행 캡 대비 페이지네이션)
  const attendances = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .range(from, to);
    if (error) throw new Error(`출석 데이터 조회 실패: ${error.message}`);
    return data ?? [];
  });

  // 날짜별 출석 수 맵
  const attendanceByDate = new Map<string, number>();
  for (const att of attendances) {
    attendanceByDate.set(att.date, (attendanceByDate.get(att.date) ?? 0) + 1);
  }

  // 월 내 주차 그룹화 (월요일 시작 기준)
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 주차 구분: 월의 첫 번째 날이 속한 ISO 주를 기준으로 월 내 1주차부터 시작
  type WeekGroup = { start: Date; end: Date; days: Date[] };
  const weekGroups: WeekGroup[] = [];

  for (const day of allDays) {
    // 0=Sun, 1=Mon ... 6=Sat (getDay)
    const dayOfWeek = day.getDay();
    // 월요일(1)이면 새 주 시작
    if (dayOfWeek === 1 || weekGroups.length === 0) {
      weekGroups.push({ start: day, end: day, days: [day] });
    } else {
      const lastGroup = weekGroups[weekGroups.length - 1];
      lastGroup.end = day;
      lastGroup.days.push(day);
    }
  }

  return weekGroups.map((group, idx) => {
    const workingDays = group.days.filter((d) => {
      if (isWeekend(d)) return false;
      return !holidayDates.has(formatDate(d));
    }).length;

    const totalAttendance = group.days.reduce(
      (sum, d) => sum + (attendanceByDate.get(formatDate(d)) ?? 0),
      0,
    );

    return {
      week_number: idx + 1,
      start_date: formatDate(group.start),
      end_date: formatDate(group.end),
      total_attendance: totalAttendance,
      working_days: workingDays,
    };
  });
}

/**
 * 요일별 평균 출석 인원을 계산합니다 (spec §2.2 weekday_avg)
 */
export async function calculateWeekdayAvg(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<WeekdayAvg> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const monthStartStr = formatDate(monthStart);
  const monthEndStr = formatDate(monthEnd);

  const holidayDates = await getHolidayDates(supabase, year, month);

  // 해당 월 전체 출석 데이터 로드 (1000행 캡 대비 페이지네이션)
  const attendances = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .range(from, to);
    if (error) throw new Error(`출석 데이터 조회 실패: ${error.message}`);
    return data ?? [];
  });

  // 날짜별 출석 수 맵
  const attendanceByDate = new Map<string, number>();
  for (const att of attendances) {
    attendanceByDate.set(att.date, (attendanceByDate.get(att.date) ?? 0) + 1);
  }

  // 요일별 집계 (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
  // WEEKDAY_KEYS: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
  const weekdayDayOfWeekMap: Record<(typeof WEEKDAY_KEYS)[number], number> = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
  };

  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const weekdaySums: Record<string, number> = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 };
  const weekdayCounts: Record<string, number> = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 };

  for (const day of allDays) {
    if (isWeekend(day)) continue;
    const dateStr = formatDate(day);
    if (holidayDates.has(dateStr)) continue;

    const dayOfWeek = day.getDay();
    const key = WEEKDAY_KEYS.find((k) => weekdayDayOfWeekMap[k] === dayOfWeek);
    if (!key) continue;

    weekdaySums[key] += attendanceByDate.get(dateStr) ?? 0;
    weekdayCounts[key] += 1;
  }

  const avg = (key: string) =>
    weekdayCounts[key] > 0
      ? Math.round((weekdaySums[key] / weekdayCounts[key]) * 100) / 100
      : 0;

  return {
    mon: avg('mon'),
    tue: avg('tue'),
    wed: avg('wed'),
    thu: avg('thu'),
    fri: avg('fri'),
  };
}

/**
 * 전월 리포트 대비 증감을 계산합니다 (spec §2.2 prev_month_comparison)
 */
export function calculatePrevMonthComparison(
  current: Pick<
    MonthlyReportResponse,
    | 'total_attendance_days'
    | 'per_patient_avg_days'
    | 'daily_avg_attendance'
    | 'consultation_attendance_rate'
    | 'registered_count_eom'
  >,
  prev: Pick<
    MonthlyReportResponse,
    | 'total_attendance_days'
    | 'per_patient_avg_days'
    | 'daily_avg_attendance'
    | 'consultation_attendance_rate'
    | 'registered_count_eom'
  > | null,
): PrevMonthComparison {
  if (!prev) {
    return {
      total_attendance_days_delta: 0,
      total_attendance_days_delta_pct: 0,
      per_patient_avg_days_delta: 0,
      daily_avg_attendance_delta: 0,
      consultation_rate_delta: 0,
      registered_count_delta: 0,
    };
  }

  const totalDelta = current.total_attendance_days - prev.total_attendance_days;
  const totalDeltaPct =
    prev.total_attendance_days > 0
      ? Math.round((totalDelta / prev.total_attendance_days) * 10000) / 100
      : 0;

  return {
    total_attendance_days_delta: totalDelta,
    total_attendance_days_delta_pct: totalDeltaPct,
    per_patient_avg_days_delta:
      Math.round(
        (current.per_patient_avg_days - prev.per_patient_avg_days) * 100,
      ) / 100,
    daily_avg_attendance_delta:
      Math.round(
        (current.daily_avg_attendance - prev.daily_avg_attendance) * 100,
      ) / 100,
    consultation_rate_delta:
      Math.round(
        (current.consultation_attendance_rate -
          prev.consultation_attendance_rate) *
          100,
      ) / 100,
    registered_count_delta:
      current.registered_count_eom - prev.registered_count_eom,
  };
}

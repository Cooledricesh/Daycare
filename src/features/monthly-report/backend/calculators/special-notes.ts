import type { SupabaseClient } from '@supabase/supabase-js';
import {
  eachDayOfInterval,
  isWeekend,
  startOfMonth,
  endOfMonth,
  format,
} from 'date-fns';
import type { Database } from '@/lib/supabase/types';
import type { SpecialNoteEntry } from '../schema';
import { fetchAllWithPagination, getHolidayDates } from './attendance';
import { OUTLIER_SIGMA_MULTIPLIER } from '../../constants/thresholds';

type Supabase = SupabaseClient<Database>;

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * 특이사항 목록을 생성합니다 (spec §2.7)
 * - holiday: 해당 월 공휴일
 * - outlier: 일일 출석 수가 평균 ± OUTLIER_SIGMA_MULTIPLIER * σ 벗어난 날
 * - data_gap: scheduled_attendances는 있지만 attendances도 없고 결석 마킹도 없는 날
 */
export async function getSpecialNotes(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<SpecialNoteEntry[]> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const monthStartStr = formatDate(monthStart);
  const monthEndStr = formatDate(monthEnd);

  const holidayDates = await getHolidayDates(supabase, year, month);

  const notes: SpecialNoteEntry[] = [];

  // 1. 공휴일 특이사항 추가
  const { data: holidayRows, error: holidayError } = await supabase
    .from('holidays')
    .select('date, reason')
    .gte('date', monthStartStr)
    .lte('date', monthEndStr);

  if (holidayError) throw new Error(`공휴일 조회 실패: ${holidayError.message}`);

  for (const holiday of holidayRows ?? []) {
    notes.push({
      type: 'holiday',
      date: holiday.date,
      description: holiday.reason,
    });
  }

  // 2. 영업일 목록 계산
  const allWorkingDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    .filter((d) => {
      if (isWeekend(d)) return false;
      return !holidayDates.has(formatDate(d));
    })
    .map(formatDate);

  if (allWorkingDays.length === 0) return notes;

  // 3. 날짜별 출석 수 (1000행 캡 대비 페이지네이션)
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

  const attendanceCountByDate = new Map<string, number>();
  for (const att of attendances) {
    attendanceCountByDate.set(att.date, (attendanceCountByDate.get(att.date) ?? 0) + 1);
  }

  // 영업일 기준 출석 수 배열
  const workingDayAttendanceCounts = allWorkingDays.map(
    (d) => attendanceCountByDate.get(d) ?? 0,
  );

  // 4. 이상치 계산: 평균 ± OUTLIER_SIGMA_MULTIPLIER * σ
  if (workingDayAttendanceCounts.length > 1) {
    const mean =
      workingDayAttendanceCounts.reduce((a, b) => a + b, 0) /
      workingDayAttendanceCounts.length;

    const variance =
      workingDayAttendanceCounts.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) /
      workingDayAttendanceCounts.length;
    const sigma = Math.sqrt(variance);

    const upperBound = mean + OUTLIER_SIGMA_MULTIPLIER * sigma;
    const lowerBound = mean - OUTLIER_SIGMA_MULTIPLIER * sigma;

    for (let i = 0; i < allWorkingDays.length; i++) {
      const dateStr = allWorkingDays[i];
      const count = workingDayAttendanceCounts[i];

      if (count > upperBound || count < lowerBound) {
        const direction = count > upperBound ? '급증' : '급감';
        notes.push({
          type: 'outlier',
          date: dateStr,
          description: `출석 ${direction}: ${count}명 (월 평균 ${Math.round(mean * 10) / 10}명 대비)`,
        });
      }
    }
  }

  // 5. 데이터 누락: scheduled_attendances 있지만 attendances/결석 마킹 없는 날 (페이지네이션)
  const scheduledDays = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('scheduled_attendances')
      .select('date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .eq('is_cancelled', false)
      .range(from, to);
    if (error) throw new Error(`예정 출석 조회 실패: ${error.message}`);
    return data ?? [];
  });

  const scheduledDateSet = new Set(scheduledDays.map((s) => s.date));
  const attendedDateSet = new Set(attendances.map((a) => a.date));

  for (const workingDay of allWorkingDays) {
    if (!scheduledDateSet.has(workingDay)) continue;
    if (attendedDateSet.has(workingDay)) continue;

    // 출석 기록이 전혀 없는 날 (공휴일이 아닌데 예정이 있고 출석이 없는 날)
    notes.push({
      type: 'data_gap',
      date: workingDay,
      description: `예정 출석이 있으나 출석 기록 없음`,
    });
  }

  // 날짜 오름차순 정렬
  notes.sort((a, b) => a.date.localeCompare(b.date));

  return notes;
}

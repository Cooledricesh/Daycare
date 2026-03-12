import { DAY_NAMES_KO } from '@/lib/date';
import type { DailyStatsItem, DayOfWeekStatsItem } from '@/features/admin/backend/schema';

const DAY_SORT_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function calculateDayOfWeekStats(dailyStats: DailyStatsItem[]): DayOfWeekStatsItem[] {
  const validStats = dailyStats.filter(
    (s) => s.attendance_rate !== null && !s.is_holiday,
  );

  const grouped = new Map<number, DailyStatsItem[]>();
  for (const stat of validStats) {
    const [y, m, d] = stat.date.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (!grouped.has(dow)) grouped.set(dow, []);
    grouped.get(dow)!.push(stat);
  }

  const result: DayOfWeekStatsItem[] = [];

  for (const dow of DAY_SORT_ORDER) {
    const items = grouped.get(dow);
    if (!items || items.length === 0) continue;

    const count = items.length;
    const avgScheduled = items.reduce((s, i) => s + i.scheduled_count, 0) / count;
    const avgAttendance = items.reduce((s, i) => s + i.attendance_count, 0) / count;
    const avgConsultation = items.reduce((s, i) => s + i.consultation_count, 0) / count;
    const avgAttendanceRate = items.reduce(
      (s, i) => s + Math.min(i.attendance_rate || 0, 100), 0,
    ) / count;

    const isWeekendDay = dow === 0 || dow === 6;
    const avgConsultationRateVsAttendance = isWeekendDay
      ? null
      : Math.round(
          (items.reduce(
            (s, i) => s + Math.min(i.consultation_rate_vs_attendance || 0, 100), 0,
          ) / count) * 10,
        ) / 10;

    result.push({
      day_of_week: dow,
      day_name: DAY_NAMES_KO[dow],
      avg_scheduled: Math.round(avgScheduled * 10) / 10,
      avg_attendance: Math.round(avgAttendance * 10) / 10,
      avg_consultation: Math.round(avgConsultation * 10) / 10,
      avg_attendance_rate: Math.round(avgAttendanceRate * 10) / 10,
      avg_consultation_rate_vs_attendance: avgConsultationRateVsAttendance,
      data_count: count,
    });
  }

  return result;
}

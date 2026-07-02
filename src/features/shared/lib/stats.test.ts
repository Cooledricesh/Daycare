import { describe, it, expect } from 'vitest';
import { calculateDayOfWeekStats } from './stats';
import type { DailyStatsItem } from '@/features/admin/backend/schema';

function item(o: Partial<DailyStatsItem> & { date: string }): DailyStatsItem {
  return {
    id: o.date,
    date: o.date,
    scheduled_count: 10,
    attendance_count: 10,
    consultation_count: 8,
    registered_count: 10,
    attendance_rate: 100,
    consultation_rate: 80,
    consultation_rate_vs_attendance: 80,
    calculated_at: '',
    is_holiday: false,
    is_weekend: false,
    is_clinic_closure: false,
    ...o,
  };
}

describe('calculateDayOfWeekStats 휴진일 처리', () => {
  // 두 개의 월요일: 하나는 정상(90%), 하나는 휴진(0%)
  const stats = [
    item({ date: '2026-07-06', consultation_rate_vs_attendance: 90 }),
    item({ date: '2026-07-13', consultation_rate_vs_attendance: 0, consultation_count: 0, is_clinic_closure: true }),
  ];

  it('휴진일은 진찰 참석률 요일 평균에서 제외 → 월요일 평균 90', () => {
    const result = calculateDayOfWeekStats(stats);
    const mon = result.find((r) => r.day_of_week === 1)!;
    expect(mon.avg_consultation_rate_vs_attendance).toBeCloseTo(90);
  });

  it('출석 평균에는 휴진일 포함 → data_count는 2', () => {
    const result = calculateDayOfWeekStats(stats);
    const mon = result.find((r) => r.day_of_week === 1)!;
    expect(mon.data_count).toBe(2);
  });
});

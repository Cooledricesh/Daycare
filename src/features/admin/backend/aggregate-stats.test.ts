import { describe, it, expect } from 'vitest';
import { aggregateStats } from './service';

type Row = Parameters<typeof aggregateStats>[0][number];

function row(overrides: Partial<Row> & { date: string }): Row {
  return {
    date: overrides.date,
    scheduled_count: 10,
    attendance_count: 10,
    consultation_count: 8,
    attendance_rate: 100,
    consultation_rate: 80,
    consultation_rate_vs_attendance: 80,
    ...overrides,
  } as Row;
}

describe('aggregateStats 휴진일 처리', () => {
  // 2026-07-06(월)~07-08(수)은 평일. 07-08을 휴진일로 지정.
  const rows = [
    row({ date: '2026-07-06', consultation_rate: 90, consultation_rate_vs_attendance: 90 }),
    row({ date: '2026-07-07', consultation_rate: 90, consultation_rate_vs_attendance: 90 }),
    row({ date: '2026-07-08', consultation_rate: 0, consultation_rate_vs_attendance: 0, consultation_count: 0 }),
  ];
  const noHolidays = new Map<string, string>();

  it('휴진일 없으면 진찰 참석률 평균은 (90+90+0)/3 = 60', () => {
    const agg = aggregateStats(rows, noHolidays, new Set());
    expect(agg.consultationDays).toBe(3);
    expect(agg.consultationRateVsAttendanceSum / agg.consultationDays).toBeCloseTo(60);
  });

  it('07-08 휴진일이면 진찰 참석률 평균은 (90+90)/2 = 90', () => {
    const agg = aggregateStats(rows, noHolidays, new Set(['2026-07-08']));
    expect(agg.consultationDays).toBe(2);
    expect(agg.consultationRateVsAttendanceSum / agg.consultationDays).toBeCloseTo(90);
  });

  it('휴진일은 진찰률(예정대비) 분모에서도 빠져 평균 왜곡 없음', () => {
    const agg = aggregateStats(rows, noHolidays, new Set(['2026-07-08']));
    expect(agg.consultationRateDays).toBe(2);
    expect(agg.consultationRateSum / agg.consultationRateDays).toBeCloseTo(90);
  });

  it('출석률 분모(attendanceDays)에는 휴진일이 그대로 포함', () => {
    const agg = aggregateStats(rows, noHolidays, new Set(['2026-07-08']));
    expect(agg.attendanceDays).toBe(3);
  });
});

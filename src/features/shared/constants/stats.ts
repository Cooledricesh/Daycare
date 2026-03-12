import { DAY_NAMES_KO } from '@/lib/date';

export { DAY_NAMES_KO };

export function parseDateStr(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

export const STATS_DATA_START_DATE = '2026-03-03';
export const STATS_DATA_START_DATE_OBJ = parseDateStr(STATS_DATA_START_DATE);

export const ATTENDANCE_RATE_THRESHOLDS = { GOOD: 90, WARNING: 70 } as const;
export const CONSULTATION_RATE_THRESHOLDS = { GOOD: 85, WARNING: 60 } as const;

export const CHART_COLORS = {
  REGISTERED: '#8b5cf6',
  SCHEDULED: '#f59e0b',
  ATTENDANCE: '#2563eb',
  CONSULTATION: '#16a34a',
} as const;

export function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return DAY_NAMES_KO[dow];
}

export function calculateMovingAverage(data: (number | null)[], window: number): (number | null)[] {
  return data.map((_, idx) => {
    const start = Math.max(0, idx - window + 1);
    const slice = data.slice(start, idx + 1).filter((v): v is number => v !== null);
    if (slice.length === 0) return null;
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
  });
}

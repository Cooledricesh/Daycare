export const STATS_DATA_START_DATE = '2026-03-03';

export const ATTENDANCE_RATE_THRESHOLDS = { GOOD: 90, WARNING: 70 } as const;
export const CONSULTATION_RATE_THRESHOLDS = { GOOD: 85, WARNING: 60 } as const;

export const CHART_COLORS = {
  REGISTERED: '#8b5cf6',
  SCHEDULED: '#f59e0b',
  ATTENDANCE: '#2563eb',
  CONSULTATION: '#16a34a',
} as const;

export const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

// 위험도 임계값 상수

export const CONSECUTIVE_ABSENCE_THRESHOLDS = {
  HIGH: 5,
  MEDIUM: 3,
} as const;

export const ATTENDANCE_RATE_THRESHOLDS = {
  HIGH: 30,
  MEDIUM: 50,
} as const;

export const TREND_THRESHOLD_PERCENT = 10;

export const PERIOD_OPTIONS = [
  { value: '14d', label: '2주' },
  { value: '30d', label: '1개월' },
  { value: '60d', label: '2개월' },
  { value: '90d', label: '3개월' },
] as const;

export type AbsencePeriod = (typeof PERIOD_OPTIONS)[number]['value'];

export const PERIOD_DAYS: Record<AbsencePeriod, number> = {
  '14d': 14,
  '30d': 30,
  '60d': 60,
  '90d': 90,
} as const;

export type RiskLevel = 'high' | 'medium' | 'low';
export type Trend = 'declining' | 'stable' | 'improving';

export const RISK_CONFIG: Record<RiskLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
}> = {
  high: {
    label: '위험',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-l-red-500',
    badgeColor: 'bg-red-100 text-red-700',
  },
  medium: {
    label: '주의',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-l-amber-400',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  low: {
    label: '정상',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-l-green-400',
    badgeColor: 'bg-green-100 text-green-700',
  },
} as const;

export const TREND_CONFIG: Record<Trend, { label: string; color: string }> = {
  declining: { label: '하락', color: 'text-red-500' },
  stable: { label: '안정', color: 'text-gray-500' },
  improving: { label: '개선', color: 'text-green-500' },
} as const;

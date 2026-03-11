// 혈압 분류 기준 (AHA 가이드라인)
export const BP_CLASSIFICATIONS = {
  CRISIS: 'crisis',
  STAGE2: 'stage2',
  STAGE1: 'stage1',
  ELEVATED: 'elevated',
  NORMAL: 'normal',
} as const;

export type BPClassification = (typeof BP_CLASSIFICATIONS)[keyof typeof BP_CLASSIFICATIONS];

export const BP_CONFIG: Record<BPClassification, { label: string; color: string; bgColor: string; chartColor: string }> = {
  [BP_CLASSIFICATIONS.CRISIS]: { label: '고혈압 위기', color: 'text-red-700', bgColor: 'bg-red-100', chartColor: '#dc2626' },
  [BP_CLASSIFICATIONS.STAGE2]: { label: '고혈압 2기', color: 'text-red-600', bgColor: 'bg-red-50', chartColor: '#ef4444' },
  [BP_CLASSIFICATIONS.STAGE1]: { label: '고혈압 1기', color: 'text-orange-600', bgColor: 'bg-orange-50', chartColor: '#f97316' },
  [BP_CLASSIFICATIONS.ELEVATED]: { label: '주의', color: 'text-yellow-600', bgColor: 'bg-yellow-50', chartColor: '#eab308' },
  [BP_CLASSIFICATIONS.NORMAL]: { label: '정상', color: 'text-green-600', bgColor: 'bg-green-50', chartColor: '#22c55e' },
};

// 혈당 분류 기준 (mg/dL, 공복 혈당)
export const BS_CLASSIFICATIONS = {
  DIABETES: 'diabetes',
  PREDIABETES: 'prediabetes',
  NORMAL: 'normal',
  LOW: 'low',
} as const;

export type BSClassification = (typeof BS_CLASSIFICATIONS)[keyof typeof BS_CLASSIFICATIONS];

export const BS_CONFIG: Record<BSClassification, { label: string; color: string; bgColor: string; chartColor: string }> = {
  [BS_CLASSIFICATIONS.DIABETES]: { label: '당뇨', color: 'text-red-600', bgColor: 'bg-red-50', chartColor: '#ef4444' },
  [BS_CLASSIFICATIONS.PREDIABETES]: { label: '당뇨전단계', color: 'text-yellow-600', bgColor: 'bg-yellow-50', chartColor: '#eab308' },
  [BS_CLASSIFICATIONS.NORMAL]: { label: '정상', color: 'text-green-600', bgColor: 'bg-green-50', chartColor: '#22c55e' },
  [BS_CLASSIFICATIONS.LOW]: { label: '저혈당', color: 'text-blue-600', bgColor: 'bg-blue-50', chartColor: '#3b82f6' },
};

// 차트 참조 범위 경계값
export const BP_THRESHOLDS = {
  NORMAL_SYSTOLIC: 120,
  ELEVATED_SYSTOLIC: 130,
  STAGE1_SYSTOLIC: 140,
  CRISIS_SYSTOLIC: 180,
  NORMAL_DIASTOLIC: 80,
  STAGE1_DIASTOLIC: 90,
  CRISIS_DIASTOLIC: 120,
} as const;

export const BS_THRESHOLDS = {
  LOW: 70,
  NORMAL: 100,
  PREDIABETES: 126,
} as const;

// 기간 옵션
export const PERIOD_OPTIONS = [
  { value: '1m', label: '1개월' },
  { value: '3m', label: '3개월' },
  { value: '6m', label: '6개월' },
  { value: '1y', label: '1년' },
] as const;

export type VitalsPeriod = (typeof PERIOD_OPTIONS)[number]['value'];

// 차트 색상
export const CHART_COLORS = {
  SYSTOLIC: '#ef4444',
  DIASTOLIC: '#3b82f6',
  BLOOD_SUGAR: '#8b5cf6',
  REFERENCE_NORMAL: 'rgba(34, 197, 94, 0.08)',
  REFERENCE_WARNING: 'rgba(234, 179, 8, 0.08)',
  REFERENCE_DANGER: 'rgba(239, 68, 68, 0.08)',
} as const;

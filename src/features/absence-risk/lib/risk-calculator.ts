import {
  CONSECUTIVE_ABSENCE_THRESHOLDS,
  ATTENDANCE_RATE_THRESHOLDS,
  TREND_THRESHOLD_PERCENT,
  type RiskLevel,
  type Trend,
} from '../constants/risk-thresholds';

export function calculateRiskLevel(
  consecutiveAbsences: number,
  attendanceRate: number,
): RiskLevel {
  const consecutiveRisk: RiskLevel =
    consecutiveAbsences >= CONSECUTIVE_ABSENCE_THRESHOLDS.HIGH
      ? 'high'
      : consecutiveAbsences >= CONSECUTIVE_ABSENCE_THRESHOLDS.MEDIUM
        ? 'medium'
        : 'low';

  const rateRisk: RiskLevel =
    attendanceRate < ATTENDANCE_RATE_THRESHOLDS.HIGH
      ? 'high'
      : attendanceRate < ATTENDANCE_RATE_THRESHOLDS.MEDIUM
        ? 'medium'
        : 'low';

  const riskOrder: Record<RiskLevel, number> = { high: 2, medium: 1, low: 0 };
  return riskOrder[consecutiveRisk] >= riskOrder[rateRisk]
    ? consecutiveRisk
    : rateRisk;
}

export function calculateTrend(recentRate: number, previousRate: number): Trend {
  const diff = recentRate - previousRate;
  if (diff <= -TREND_THRESHOLD_PERCENT) return 'declining';
  if (diff >= TREND_THRESHOLD_PERCENT) return 'improving';
  return 'stable';
}

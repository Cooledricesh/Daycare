'use client';

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RISK_CONFIG, TREND_CONFIG, ATTENDANCE_RATE_THRESHOLDS } from '../constants/risk-thresholds';
import type { AbsenceSummary } from '../backend/schema';

interface AbsenceSummaryCardsProps {
  summary: AbsenceSummary;
}

export function AbsenceSummaryCards({ summary }: AbsenceSummaryCardsProps) {
  const riskConfig = RISK_CONFIG[summary.risk_level];
  const trendConfig = TREND_CONFIG[summary.trend];

  const TrendIcon =
    summary.trend === 'declining'
      ? TrendingDown
      : summary.trend === 'improving'
        ? TrendingUp
        : Minus;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white rounded-lg border p-3 space-y-1">
        <p className="text-xs text-gray-500">연속 결석</p>
        <p
          className={cn(
            'text-2xl font-bold',
            summary.consecutive_absences >= 5
              ? 'text-red-600'
              : summary.consecutive_absences >= 3
                ? 'text-amber-600'
                : 'text-gray-700',
          )}
        >
          {summary.consecutive_absences}
          <span className="text-sm font-normal ml-1">일</span>
        </p>
        <p className="text-xs text-gray-400">어제 기준</p>
      </div>

      <div className="bg-white rounded-lg border p-3 space-y-1">
        <p className="text-xs text-gray-500">출석률</p>
        <p
          className={cn(
            'text-2xl font-bold',
            summary.attendance_rate < ATTENDANCE_RATE_THRESHOLDS.HIGH
              ? 'text-red-600'
              : summary.attendance_rate < ATTENDANCE_RATE_THRESHOLDS.MEDIUM
                ? 'text-amber-600'
                : 'text-green-600',
          )}
        >
          {summary.attendance_rate}
          <span className="text-sm font-normal ml-0.5">%</span>
        </p>
        <p className="text-xs text-gray-400">
          {summary.total_attended}/{summary.total_scheduled}일
        </p>
      </div>

      <div className="bg-white rounded-lg border p-3 space-y-1">
        <p className="text-xs text-gray-500">결석 / 예정</p>
        <p className="text-2xl font-bold text-gray-700">
          {summary.total_absent}
          <span className="text-sm font-normal text-gray-400 ml-1">/ {summary.total_scheduled}일</span>
        </p>
        <p className="text-xs text-gray-400">
          마지막 출석: {summary.last_attended_date || '없음'}
        </p>
      </div>

      <div className="bg-white rounded-lg border p-3 space-y-1">
        <p className="text-xs text-gray-500">출석 추세</p>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={cn('w-5 h-5', trendConfig.color)} />
          <span className={cn('text-lg font-bold', trendConfig.color)}>
            {trendConfig.label}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          최근 {summary.recent_rate}% → 이전 {summary.previous_rate}%
        </p>
      </div>
    </div>
  );
}

'use client';

import type { DailyStatsItem } from '@/features/admin/backend/schema';
import { CHART_COLORS, CONSULTATION_RATE_THRESHOLDS } from '@/features/shared/constants/stats';
import { RateLineChart } from './RateLineChart';

interface ConsultationRateChartProps {
  dailyStats: DailyStatsItem[];
}

export function ConsultationRateChart({ dailyStats }: ConsultationRateChartProps) {
  return (
    <RateLineChart
      dailyStats={dailyStats}
      title="진찰 참석률 추이 (실출석 대비)"
      dataKey="consultation_rate_vs_attendance"
      label="진찰 참석률"
      color={CHART_COLORS.CONSULTATION}
      thresholds={CONSULTATION_RATE_THRESHOLDS}
      filterWeekends
      renderTooltipContent={(data) => (
        <div className="bg-white border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">
            {data.fullDate}
            {data.isHoliday && <span className="text-gray-400 ml-1">({data.holidayReason || '공휴일'})</span>}
            {data.isWeekend && !data.isHoliday && <span className="text-gray-400 ml-1">(주말)</span>}
          </p>
          <div className="space-y-1 text-sm">
            {data.isHoliday ? (
              <p className="text-gray-400">공휴일 - 통계 제외</p>
            ) : data.isWeekend ? (
              <p className="text-gray-400">주말 - 진찰 미운영</p>
            ) : (
              <>
                <p>출석: {data.attendance}명 / 진찰: {data.consultation}명</p>
                <p className="text-green-600">
                  진찰 참석률: {data.rate != null ? `${data.rate.toFixed(1)}%` : '-'}
                </p>
                <p className="text-green-400">
                  7일 이동평균: {data.movingAvg != null ? `${data.movingAvg.toFixed(1)}%` : '-'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    />
  );
}

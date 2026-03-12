'use client';

import type { DailyStatsItem } from '@/features/admin/backend/schema';
import { CHART_COLORS, ATTENDANCE_RATE_THRESHOLDS } from '@/features/shared/constants/stats';
import { RateLineChart } from './RateLineChart';

interface AttendanceRateChartProps {
  dailyStats: DailyStatsItem[];
}

export function AttendanceRateChart({ dailyStats }: AttendanceRateChartProps) {
  return (
    <RateLineChart
      dailyStats={dailyStats}
      title="출석률 추이"
      dataKey="attendance_rate"
      label="출석률"
      color={CHART_COLORS.ATTENDANCE}
      thresholds={ATTENDANCE_RATE_THRESHOLDS}
      renderTooltipContent={(data) => (
        <div className="bg-white border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">
            {data.fullDate}
            {data.isHoliday && <span className="text-gray-400 ml-1">({data.holidayReason || '공휴일'})</span>}
          </p>
          <div className="space-y-1 text-sm">
            {data.isHoliday ? (
              <p className="text-gray-400">공휴일 - 통계 제외</p>
            ) : (
              <>
                <p>예정: {data.scheduled}명 / 출석: {data.attendance}명</p>
                <p className="text-blue-600">
                  출석률: {data.rate != null ? `${data.rate.toFixed(1)}%` : '-'}
                </p>
                <p className="text-blue-400">
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

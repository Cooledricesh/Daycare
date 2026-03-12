'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import type { DailyStatsItem } from '@/features/admin/backend/schema';
import { CHART_COLORS, ATTENDANCE_RATE_THRESHOLDS, parseDateStr, calculateMovingAverage } from '@/features/shared/constants/stats';

interface AttendanceRateChartProps {
  dailyStats: DailyStatsItem[];
}

export function AttendanceRateChart({ dailyStats }: AttendanceRateChartProps) {
  const rates = dailyStats.map((s) => s.is_holiday ? null : s.attendance_rate);
  const movingAvg = calculateMovingAverage(rates, 7);

  const chartData = dailyStats.map((stat, idx) => ({
    date: format(parseDateStr(stat.date), 'MM/dd'),
    fullDate: stat.date,
    attendanceRate: stat.is_holiday ? null : stat.attendance_rate,
    movingAvg: movingAvg[idx],
    scheduled: stat.scheduled_count,
    attendance: stat.attendance_count,
    isHoliday: stat.is_holiday,
    holidayReason: stat.holiday_reason,
  }));

  const holidayDates = chartData.filter((d) => d.isHoliday);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">출석률 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis domain={[0, 100]} fontSize={12} tickFormatter={(v) => `${v}%`} />
            <ReferenceArea y1={ATTENDANCE_RATE_THRESHOLDS.GOOD} y2={100} fill="#dcfce7" fillOpacity={0.3} />
            <ReferenceArea y1={ATTENDANCE_RATE_THRESHOLDS.WARNING} y2={ATTENDANCE_RATE_THRESHOLDS.GOOD} fill="#fef9c3" fillOpacity={0.3} />
            <ReferenceArea y1={0} y2={ATTENDANCE_RATE_THRESHOLDS.WARNING} fill="#fecaca" fillOpacity={0.3} />
            {holidayDates.map((h) => (
              <ReferenceLine
                key={h.fullDate}
                x={h.date}
                stroke="#9ca3af"
                strokeDasharray="4 4"
                label={{ value: h.holidayReason || '공휴일', position: 'top', fontSize: 10, fill: '#9ca3af' }}
              />
            ))}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload;
                return (
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
                            출석률: {data.attendanceRate != null ? `${data.attendanceRate.toFixed(1)}%` : '-'}
                          </p>
                          <p className="text-blue-400">
                            7일 이동평균: {data.movingAvg != null ? `${data.movingAvg.toFixed(1)}%` : '-'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="attendanceRate"
              stroke={CHART_COLORS.ATTENDANCE}
              name="출석률 (%)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="movingAvg"
              stroke={CHART_COLORS.ATTENDANCE}
              name="7일 이동평균"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls
              opacity={0.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

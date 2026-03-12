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
import { CHART_COLORS, CONSULTATION_RATE_THRESHOLDS, parseDateStr, calculateMovingAverage } from '@/features/shared/constants/stats';

interface ConsultationRateChartProps {
  dailyStats: DailyStatsItem[];
}

export function ConsultationRateChart({ dailyStats }: ConsultationRateChartProps) {
  const rates = dailyStats.map((s) =>
    s.is_holiday || s.is_weekend ? null : s.consultation_rate_vs_attendance
  );
  const movingAvg = calculateMovingAverage(rates, 7);

  const chartData = dailyStats.map((stat, idx) => ({
    date: format(parseDateStr(stat.date), 'MM/dd'),
    fullDate: stat.date,
    consultationRate: stat.is_holiday || stat.is_weekend ? null : stat.consultation_rate_vs_attendance,
    movingAvg: movingAvg[idx],
    attendance: stat.attendance_count,
    consultation: stat.consultation_count,
    isHoliday: stat.is_holiday,
    isWeekend: stat.is_weekend,
    holidayReason: stat.holiday_reason,
  }));

  const holidayDates = chartData.filter((d) => d.isHoliday);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">진찰 참석률 추이 (실출석 대비)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis domain={[0, 100]} fontSize={12} tickFormatter={(v) => `${v}%`} />
            <ReferenceArea y1={CONSULTATION_RATE_THRESHOLDS.GOOD} y2={100} fill="#dcfce7" fillOpacity={0.3} />
            <ReferenceArea y1={CONSULTATION_RATE_THRESHOLDS.WARNING} y2={CONSULTATION_RATE_THRESHOLDS.GOOD} fill="#fef9c3" fillOpacity={0.3} />
            <ReferenceArea y1={0} y2={CONSULTATION_RATE_THRESHOLDS.WARNING} fill="#fecaca" fillOpacity={0.3} />
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
                            진찰 참석률: {data.consultationRate != null ? `${data.consultationRate.toFixed(1)}%` : '-'}
                          </p>
                          <p className="text-green-400">
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
              dataKey="consultationRate"
              stroke={CHART_COLORS.CONSULTATION}
              name="진찰 참석률 (%)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="movingAvg"
              stroke={CHART_COLORS.CONSULTATION}
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

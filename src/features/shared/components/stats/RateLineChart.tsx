'use client';

import { useMemo } from 'react';
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
import { parseDateStr, calculateMovingAverage } from '@/features/shared/constants/stats';

interface RateLineChartProps {
  dailyStats: DailyStatsItem[];
  title: string;
  dataKey: 'attendance_rate' | 'consultation_rate_vs_attendance';
  label: string;
  color: string;
  thresholds: { GOOD: number; WARNING: number };
  filterWeekends?: boolean;
  yDomain?: [number, number];
  renderTooltipContent: (data: any) => React.ReactNode;
}

export function RateLineChart({
  dailyStats,
  title,
  dataKey,
  label,
  color,
  thresholds,
  filterWeekends = false,
  yDomain = [0, 100],
  renderTooltipContent,
}: RateLineChartProps) {
  const { chartData, holidayDates } = useMemo(() => {
    const rates = dailyStats.map((s) => {
      if (s.is_holiday) return null;
      if (filterWeekends && s.is_weekend) return null;
      return s[dataKey] as number | null;
    });
    const movingAvg = calculateMovingAverage(rates, 7);

    const data = dailyStats.map((stat, idx) => ({
      date: format(parseDateStr(stat.date), 'MM/dd'),
      fullDate: stat.date,
      rate: rates[idx],
      movingAvg: movingAvg[idx],
      scheduled: stat.scheduled_count,
      attendance: stat.attendance_count,
      consultation: stat.consultation_count,
      isHoliday: stat.is_holiday,
      isWeekend: stat.is_weekend,
      holidayReason: stat.holiday_reason,
    }));

    return {
      chartData: data,
      holidayDates: data.filter((d) => d.isHoliday),
    };
  }, [dailyStats, dataKey, filterWeekends]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis domain={yDomain} fontSize={12} tickFormatter={(v) => `${v}%`} />
            <ReferenceArea y1={thresholds.GOOD} y2={100} fill="#dcfce7" fillOpacity={0.3} />
            <ReferenceArea y1={thresholds.WARNING} y2={thresholds.GOOD} fill="#fef9c3" fillOpacity={0.3} />
            <ReferenceArea y1={0} y2={thresholds.WARNING} fill="#fecaca" fillOpacity={0.3} />
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
                return renderTooltipContent(payload[0].payload);
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="rate"
              stroke={color}
              name={`${label} (%)`}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="movingAvg"
              stroke={color}
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

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import type { DailyStatsItem } from '@/features/admin/backend/schema';
import { CHART_COLORS } from '@/features/shared/constants/stats';

interface RegisteredPatientChartProps {
  dailyStats: DailyStatsItem[];
}

export function RegisteredPatientChart({ dailyStats }: RegisteredPatientChartProps) {
  const chartData = dailyStats
    .filter((s) => s.registered_count > 0)
    .map((stat) => ({
      date: format(new Date(stat.date + 'T00:00:00'), 'MM/dd'),
      fullDate: stat.date,
      registered: stat.registered_count,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">등록환자 수 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400 text-sm">
            등록환자 데이터가 없습니다. 통계 재계산을 실행해주세요.
          </div>
        </CardContent>
      </Card>
    );
  }

  const values = chartData.map((d) => d.registered);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const padding = Math.max(Math.ceil((dataMax - dataMin) * 0.3), 5);
  const yMin = Math.max(0, Math.floor((dataMin - padding) / 5) * 5);
  const yMax = Math.ceil((dataMax + padding) / 5) * 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">등록환자 수 추이</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis domain={[yMin, yMax]} fontSize={12} tickFormatter={(v) => `${v}명`} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-white border rounded-lg shadow-lg p-3">
                    <p className="font-medium mb-1">{data.fullDate}</p>
                    <p className="text-sm text-violet-600">
                      등록환자: {data.registered}명
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="registered"
              stroke={CHART_COLORS.REGISTERED}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

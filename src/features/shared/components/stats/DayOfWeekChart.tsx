'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DayOfWeekStatsItem } from '@/features/admin/backend/schema';
import { CHART_COLORS } from '@/features/shared/constants/stats';

interface DayOfWeekChartProps {
  data: DayOfWeekStatsItem[];
  isLoading: boolean;
}

export function DayOfWeekChart({ data, isLoading }: DayOfWeekChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">요일별 평균 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">요일별 평균 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400 text-sm">데이터가 없습니다.</div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => {
    const isWeekendDay = item.day_of_week === 0 || item.day_of_week === 6;
    return {
      name: `${item.day_name}요일`,
      avg_scheduled: item.avg_scheduled,
      avg_attendance: item.avg_attendance,
      avg_consultation: isWeekendDay ? null : item.avg_consultation,
      avg_attendance_rate: item.avg_attendance_rate,
      avg_consultation_rate_vs_attendance: item.avg_consultation_rate_vs_attendance,
      data_count: item.data_count,
      isWeekend: isWeekendDay,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">요일별 평균 현황</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border rounded-lg shadow-lg p-3">
                    <p className="font-medium mb-2">{d.name}</p>
                    <div className="space-y-1 text-sm">
                      <p style={{ color: CHART_COLORS.SCHEDULED }}>
                        평균 예정: {d.avg_scheduled}명
                      </p>
                      <p style={{ color: CHART_COLORS.ATTENDANCE }}>
                        평균 출석: {d.avg_attendance}명
                      </p>
                      {d.isWeekend ? (
                        <p className="text-gray-400">진찰 미운영</p>
                      ) : (
                        <p style={{ color: CHART_COLORS.CONSULTATION }}>
                          평균 진찰: {d.avg_consultation}명
                        </p>
                      )}
                      <hr className="my-1" />
                      <p>출석률: {d.avg_attendance_rate}%</p>
                      {d.isWeekend ? (
                        <p className="text-gray-400">진찰 참석률: 미운영</p>
                      ) : (
                        <p>진찰 참석률: {d.avg_consultation_rate_vs_attendance != null ? `${d.avg_consultation_rate_vs_attendance}%` : '-'}</p>
                      )}
                      <p className="text-gray-400">데이터: {d.data_count}일</p>
                    </div>
                  </div>
                );
              }}
            />
            <Legend />
            <Bar
              dataKey="avg_scheduled"
              fill={CHART_COLORS.SCHEDULED}
              name="평균 예정"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="avg_attendance"
              fill={CHART_COLORS.ATTENDANCE}
              name="평균 출석"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="avg_consultation"
              fill={CHART_COLORS.CONSULTATION}
              name="평균 진찰"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

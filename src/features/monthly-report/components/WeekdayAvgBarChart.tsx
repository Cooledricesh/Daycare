'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { WEEKDAY_LABELS } from '../constants/labels';
import type { WeekdayAvg } from '../lib/dto';

interface WeekdayAvgBarChartProps {
  weekdayAvg: WeekdayAvg;
}

const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;

export function WeekdayAvgBarChart({ weekdayAvg }: WeekdayAvgBarChartProps) {
  const data = WEEKDAY_ORDER.map((key) => ({
    name: WEEKDAY_LABELS[key],
    평균인원: Number(weekdayAvg[key]).toFixed(1),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">요일별 평균 출석 인원</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="평균인원" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

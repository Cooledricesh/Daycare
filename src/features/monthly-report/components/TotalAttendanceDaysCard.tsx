'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';
import type { MonthlyReportResponse } from '../lib/dto';

interface TotalAttendanceDaysCardProps {
  report: MonthlyReportResponse;
}

function DeltaBadge({ delta, deltaPct }: { delta: number; deltaPct: number }) {
  const isPositive = delta >= 0;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-500';
  const arrow = isPositive ? '▲' : '▼';
  return (
    <span className={`text-sm font-medium ${colorClass}`}>
      {arrow} {Math.abs(deltaPct).toFixed(1)}%
    </span>
  );
}

export function TotalAttendanceDaysCard({ report }: TotalAttendanceDaysCardProps) {
  const { total_attendance_days, prev_month_comparison } = report;
  const { total_attendance_days_delta, total_attendance_days_delta_pct } = prev_month_comparison;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">월 총 출석일수</CardTitle>
        <CalendarDays className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-gray-900">{total_attendance_days.toLocaleString()}</div>
        <div className="flex items-center gap-1 mt-1">
          <DeltaBadge delta={total_attendance_days_delta} deltaPct={total_attendance_days_delta_pct} />
          <span className="text-xs text-gray-400">전월 대비</span>
        </div>
      </CardContent>
    </Card>
  );
}

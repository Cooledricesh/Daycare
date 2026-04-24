'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from 'lucide-react';
import type { MonthlyReportResponse } from '../lib/dto';

interface PerPatientAvgDaysCardProps {
  report: MonthlyReportResponse;
}

function DeltaBadge({ delta }: { delta: number }) {
  const isPositive = delta >= 0;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-500';
  const arrow = isPositive ? '▲' : '▼';
  return (
    <span className={`text-sm font-medium ${colorClass}`}>
      {arrow} {Math.abs(delta).toFixed(2)}일
    </span>
  );
}

export function PerPatientAvgDaysCard({ report }: PerPatientAvgDaysCardProps) {
  const { per_patient_avg_days, prev_month_comparison } = report;
  const { per_patient_avg_days_delta } = prev_month_comparison;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">1인당 월평균 출석</CardTitle>
        <User className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-gray-900">
          {Number(per_patient_avg_days).toFixed(1)}
          <span className="text-lg font-normal text-gray-500 ml-1">일</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <DeltaBadge delta={per_patient_avg_days_delta} />
          <span className="text-xs text-gray-400">전월 대비</span>
        </div>
      </CardContent>
    </Card>
  );
}

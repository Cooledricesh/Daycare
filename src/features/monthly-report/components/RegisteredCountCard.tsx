'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCheck } from 'lucide-react';
import type { MonthlyReportResponse } from '../lib/dto';

interface RegisteredCountCardProps {
  report: MonthlyReportResponse;
}

function DeltaBadge({ delta }: { delta: number }) {
  const isPositive = delta >= 0;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-500';
  const arrow = isPositive ? '▲' : '▼';
  return (
    <span className={`text-sm font-medium ${colorClass}`}>
      {arrow} {Math.abs(delta)}명
    </span>
  );
}

export function RegisteredCountCard({ report }: RegisteredCountCardProps) {
  const { registered_count_eom, new_patient_count, discharged_count, prev_month_comparison } = report;
  const { registered_count_delta } = prev_month_comparison;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">등록 환자 수 (월말)</CardTitle>
        <UserCheck className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-gray-900">
          {registered_count_eom.toLocaleString()}
          <span className="text-lg font-normal text-gray-500 ml-1">명</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <DeltaBadge delta={registered_count_delta} />
          <span className="text-xs text-gray-400">전월 대비</span>
        </div>
        <div className="flex gap-3 mt-2 text-xs text-gray-500">
          <span className="text-green-600">+{new_patient_count}명 신규</span>
          <span className="text-red-500">-{discharged_count}명 퇴원</span>
        </div>
      </CardContent>
    </Card>
  );
}

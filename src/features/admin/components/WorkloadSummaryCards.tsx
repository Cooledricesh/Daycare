'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, BarChart2 } from 'lucide-react';
import type { CoordinatorWorkloadSummary } from '@/features/admin/backend/schema';

interface WorkloadSummaryCardsProps {
  summary: CoordinatorWorkloadSummary;
}

function getImbalanceColor(index: number): string {
  if (index <= 30) return 'text-green-600';
  if (index <= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function WorkloadSummaryCards({ summary }: WorkloadSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">팀 일평균 출석</CardTitle>
          <Users className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.team_total_avg_attendance.toFixed(1)}명
          </div>
          <p className="text-xs text-gray-500 mt-1">
            영업일 {summary.working_days}일 기준
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">코디당 평균</CardTitle>
          <Activity className="h-4 w-4 text-violet-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.per_coordinator_avg.toFixed(1)}명
          </div>
          <p className="text-xs text-gray-500 mt-1">
            코디 {summary.coordinators.length}명 기준 1인당 적정 부하
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">불균형 지수</CardTitle>
          <BarChart2 className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getImbalanceColor(summary.imbalance_index)}`}>
            {summary.imbalance_index.toFixed(1)}%
          </div>
          <p className="text-xs text-gray-500 mt-1">
            낮을수록 업무 균형 상태
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

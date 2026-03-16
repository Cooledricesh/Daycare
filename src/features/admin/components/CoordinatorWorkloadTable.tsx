'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { CoordinatorWorkloadItem } from '@/features/admin/backend/schema';

interface CoordinatorWorkloadTableProps {
  coordinators: CoordinatorWorkloadItem[];
  perCoordinatorAvg: number;
}

const WORKLOAD_BADGE_VARIANT = {
  heavy: { label: '과중', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  normal: { label: '적정', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  light: { label: '여유', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
} as const;

const ATTENDANCE_RATE_THRESHOLDS = { GOOD: 80, WARNING: 60 } as const;

function getRateColor(rate: number, thresholds: { GOOD: number; WARNING: number }): string {
  if (rate >= thresholds.GOOD) return 'text-green-600';
  if (rate >= thresholds.WARNING) return 'text-yellow-600';
  return 'text-red-600';
}

interface AttendanceBarProps {
  value: number;
  maxValue: number;
}

function AttendanceBar({ value, maxValue }: AttendanceBarProps) {
  const widthPercent = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden min-w-[60px]">
        <div
          className="h-full bg-blue-500 rounded"
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <span className="text-sm font-medium w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

export function CoordinatorWorkloadTable({
  coordinators,
  perCoordinatorAvg,
}: CoordinatorWorkloadTableProps) {
  const maxAvgAttendance = coordinators.length > 0
    ? Math.max(...coordinators.map((c) => c.avg_daily_attendance))
    : 1;

  if (coordinators.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        코디네이터 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[80px]">이름</TableHead>
            <TableHead className="min-w-[70px] text-right">담당 환자</TableHead>
            <TableHead className="min-w-[160px]">일평균 출석 수</TableHead>
            <TableHead className="min-w-[70px] text-right">출석률</TableHead>
            <TableHead className="min-w-[90px] text-right">일평균 진찰 수</TableHead>
            <TableHead className="min-w-[90px] text-right">진찰 전환율</TableHead>
            <TableHead className="min-w-[70px]">워크로드</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coordinators.map((coordinator) => {
            const badge = WORKLOAD_BADGE_VARIANT[coordinator.workload_level];

            return (
              <TableRow key={coordinator.coordinator_id}>
                <TableCell className="font-medium">
                  {coordinator.coordinator_name}
                </TableCell>
                <TableCell className="text-right">
                  {coordinator.patient_count}명
                </TableCell>
                <TableCell>
                  <AttendanceBar
                    value={coordinator.avg_daily_attendance}
                    maxValue={maxAvgAttendance}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <span className={getRateColor(coordinator.attendance_rate, ATTENDANCE_RATE_THRESHOLDS)}>
                    {coordinator.attendance_rate.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {coordinator.avg_daily_consultation.toFixed(1)}
                </TableCell>
                <TableCell className="text-right">
                  {coordinator.consultation_conversion_rate.toFixed(1)}%
                </TableCell>
                <TableCell>
                  <Badge className={badge.className}>
                    {badge.label}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {perCoordinatorAvg > 0 && (
        <div className="px-4 py-2 text-xs text-gray-500 border-t bg-gray-50">
          기준선: 코디당 평균 일출석 {perCoordinatorAvg.toFixed(1)}명
          &nbsp;|&nbsp;
          과중 기준: {(perCoordinatorAvg * 1.3).toFixed(1)}명 초과
          &nbsp;|&nbsp;
          여유 기준: {(perCoordinatorAvg * 0.7).toFixed(1)}명 미만
        </div>
      )}
    </div>
  );
}

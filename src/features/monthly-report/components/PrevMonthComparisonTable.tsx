'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PrevMonthComparison, MonthlyReportResponse } from '../lib/dto';

interface PrevMonthComparisonTableProps {
  report: MonthlyReportResponse;
}

type ComparisonRow = {
  label: string;
  current: string;
  delta: number;
  deltaLabel: string;
};

function DeltaCell({ delta, label }: { delta: number; label: string }) {
  if (delta === 0) return <span className="text-gray-400">변동 없음</span>;
  const isPositive = delta > 0;
  const colorClass = isPositive ? 'text-green-600' : 'text-red-500';
  const arrow = isPositive ? '▲' : '▼';
  return (
    <span className={`font-medium ${colorClass}`}>
      {arrow} {Math.abs(delta).toFixed(1)}{label}
    </span>
  );
}

export function PrevMonthComparisonTable({ report }: PrevMonthComparisonTableProps) {
  const { prev_month_comparison } = report;

  const rows: ComparisonRow[] = [
    {
      label: '월 총 출석일수',
      current: `${report.total_attendance_days.toLocaleString()}일`,
      delta: prev_month_comparison.total_attendance_days_delta,
      deltaLabel: '일',
    },
    {
      label: '1인당 월평균 출석',
      current: `${Number(report.per_patient_avg_days).toFixed(1)}일`,
      delta: prev_month_comparison.per_patient_avg_days_delta,
      deltaLabel: '일',
    },
    {
      label: '일평균 출석 인원',
      current: `${Number(report.daily_avg_attendance).toFixed(1)}명`,
      delta: prev_month_comparison.daily_avg_attendance_delta,
      deltaLabel: '명',
    },
    {
      label: '진찰 참석률',
      current: `${Number(report.consultation_attendance_rate).toFixed(1)}%`,
      delta: prev_month_comparison.consultation_rate_delta,
      deltaLabel: '%p',
    },
    {
      label: '등록 환자 수',
      current: `${report.registered_count_eom.toLocaleString()}명`,
      delta: prev_month_comparison.registered_count_delta,
      deltaLabel: '명',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">전월 대비</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>지표</TableHead>
              <TableHead className="text-right">이번 달</TableHead>
              <TableHead className="text-right">전월 대비</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right">{row.current}</TableCell>
                <TableCell className="text-right">
                  <DeltaCell delta={row.delta} label={row.deltaLabel} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

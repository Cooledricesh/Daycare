'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DailyStatsItem } from '@/features/admin/backend/schema';
import { ATTENDANCE_RATE_THRESHOLDS, CONSULTATION_RATE_THRESHOLDS, DAY_NAMES_KO } from '@/features/shared/constants/stats';

interface StatsDetailTableProps {
  dailyStats: DailyStatsItem[];
}

function getRateCellClass(rate: number | null, thresholds: { GOOD: number; WARNING: number }) {
  if (rate === null) return '';
  if (rate >= thresholds.GOOD) return 'text-green-700 bg-green-50';
  if (rate >= thresholds.WARNING) return 'text-yellow-700 bg-yellow-50';
  return 'text-red-700 bg-red-50';
}

function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return DAY_NAMES_KO[dow];
}

export function StatsDetailTable({ dailyStats }: StatsDetailTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sortedStats = [...dailyStats].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">상세 통계</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              접기
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              펼치기 ({sortedStats.length}일)
            </>
          )}
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-white">날짜</TableHead>
                  <TableHead className="sticky top-0 bg-white">요일</TableHead>
                  <TableHead className="sticky top-0 bg-white text-right">등록</TableHead>
                  <TableHead className="sticky top-0 bg-white text-right">예정</TableHead>
                  <TableHead className="sticky top-0 bg-white text-right">출석</TableHead>
                  <TableHead className="sticky top-0 bg-white text-right">진찰</TableHead>
                  <TableHead className="sticky top-0 bg-white text-right">출석률</TableHead>
                  <TableHead className="sticky top-0 bg-white text-right">진찰 참석률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStats.map((stat) => {
                  const rowClass = stat.is_holiday
                    ? 'bg-gray-100 text-gray-400'
                    : stat.is_weekend
                      ? 'bg-gray-50'
                      : '';

                  return (
                    <TableRow key={stat.id} className={rowClass}>
                      <TableCell className="font-mono text-sm">
                        <span className="flex items-center gap-1.5">
                          {stat.date}
                          {stat.is_holiday && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                              {stat.holiday_reason || '공휴일'}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{getDayName(stat.date)}</TableCell>
                      <TableCell className="text-right">{stat.registered_count}</TableCell>
                      <TableCell className="text-right">{stat.scheduled_count}</TableCell>
                      <TableCell className="text-right">{stat.attendance_count}</TableCell>
                      <TableCell className="text-right">{stat.consultation_count}</TableCell>
                      <TableCell className={`text-right ${stat.is_holiday ? '' : getRateCellClass(stat.attendance_rate, ATTENDANCE_RATE_THRESHOLDS)}`}>
                        {stat.is_holiday
                          ? '제외'
                          : stat.attendance_rate != null
                            ? `${stat.attendance_rate.toFixed(1)}%`
                            : '-'}
                      </TableCell>
                      <TableCell className={`text-right ${stat.is_holiday || stat.is_weekend ? '' : getRateCellClass(stat.consultation_rate_vs_attendance, CONSULTATION_RATE_THRESHOLDS)}`}>
                        {stat.is_holiday
                          ? '제외'
                          : stat.is_weekend
                            ? '-'
                            : stat.consultation_rate_vs_attendance != null
                              ? `${stat.consultation_rate_vs_attendance.toFixed(1)}%`
                              : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

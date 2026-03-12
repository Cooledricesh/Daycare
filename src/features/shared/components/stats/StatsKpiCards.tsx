'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, Activity, Stethoscope, CalendarCheck } from 'lucide-react';
import type { StatsSummary } from '@/features/admin/backend/schema';
import { ATTENDANCE_RATE_THRESHOLDS, CONSULTATION_RATE_THRESHOLDS } from '@/features/shared/constants/stats';

interface StatsKpiCardsProps {
  summary: StatsSummary;
}

function getRateColor(rate: number, thresholds: { GOOD: number; WARNING: number }) {
  if (rate >= thresholds.GOOD) return 'text-green-600';
  if (rate >= thresholds.WARNING) return 'text-yellow-600';
  return 'text-red-600';
}

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  const change = current - previous;
  if (change === 0) return null;

  return (
    <div className={`flex items-center text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
      {change >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
      {Math.abs(change).toFixed(1)}%
    </div>
  );
}

export function StatsKpiCards({ summary }: StatsKpiCardsProps) {
  const attendanceChange = summary.average_attendance_rate - summary.previous_period.average_attendance_rate;
  const consultationVsAttendanceChange = summary.average_consultation_rate_vs_attendance - summary.previous_period.average_consultation_rate_vs_attendance;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 등록환자 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">등록환자</CardTitle>
          <Users className="h-4 w-4 text-violet-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.today.registered}명</div>
          <p className="text-xs text-gray-500 mt-1">
            현재 active 환자 수
          </p>
        </CardContent>
      </Card>

      {/* 평균 출석률 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">평균 출석률</CardTitle>
          <TrendIndicator
            current={summary.average_attendance_rate}
            previous={summary.previous_period.average_attendance_rate}
          />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getRateColor(summary.average_attendance_rate, ATTENDANCE_RATE_THRESHOLDS)}`}>
            {summary.average_attendance_rate.toFixed(1)}%
          </div>
          <p className="text-xs text-gray-500 mt-1">
            전기간 대비 {attendanceChange >= 0 ? '+' : ''}{attendanceChange.toFixed(1)}%
            {summary.excluded_holidays > 0 && (
              <span className="block text-gray-400">
                (공휴일 {summary.excluded_holidays}일 제외)
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* 평균 진찰 참석률 (실출석 대비) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">평균 진찰 참석률</CardTitle>
          <TrendIndicator
            current={summary.average_consultation_rate_vs_attendance}
            previous={summary.previous_period.average_consultation_rate_vs_attendance}
          />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getRateColor(summary.average_consultation_rate_vs_attendance, CONSULTATION_RATE_THRESHOLDS)}`}>
            {summary.average_consultation_rate_vs_attendance.toFixed(1)}%
          </div>
          <p className="text-xs text-gray-500 mt-1">
            전기간 대비 {consultationVsAttendanceChange >= 0 ? '+' : ''}{consultationVsAttendanceChange.toFixed(1)}%
            {(summary.excluded_holidays > 0 || summary.excluded_weekends_for_consultation > 0) && (
              <span className="block text-gray-400">
                ({[
                  summary.excluded_holidays > 0 && `공휴일 ${summary.excluded_holidays}일`,
                  summary.excluded_weekends_for_consultation > 0 && `주말 ${summary.excluded_weekends_for_consultation}일`,
                ].filter(Boolean).join(', ')} 제외)
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* 오늘 현황 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">오늘 현황</CardTitle>
          <CalendarCheck className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.today.attendance} / {summary.today.scheduled}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            진찰: {summary.today.consultation}명
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

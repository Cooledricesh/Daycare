'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ConsultationStats } from '../lib/dto';

interface ConsultationStatsSectionProps {
  consultationStats: ConsultationStats;
}

export function ConsultationStatsSection({ consultationStats }: ConsultationStatsSectionProps) {
  const { scheduled_count, performed_count, missed_count, missed_by_reason } = consultationStats;

  const attendanceRate = scheduled_count > 0
    ? ((performed_count / scheduled_count) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">진찰 운영 현황</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">예정 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{scheduled_count.toLocaleString()}</div>
            <p className="text-xs text-gray-400 mt-1">건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">실시 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{performed_count.toLocaleString()}</div>
            <p className="text-xs text-gray-400 mt-1">참석률 {attendanceRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">누락 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{missed_count.toLocaleString()}</div>
            <p className="text-xs text-gray-400 mt-1">건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">누락 사유</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">결석</span>
                <span className="font-medium">{missed_by_reason.absent}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">기타</span>
                <span className="font-medium">{missed_by_reason.other}건</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

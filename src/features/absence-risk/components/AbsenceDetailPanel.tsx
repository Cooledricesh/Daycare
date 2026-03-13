'use client';

import { UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPatientDisplayName } from '@/lib/patient';
import { PERIOD_OPTIONS, RISK_CONFIG, type AbsencePeriod } from '../constants/risk-thresholds';
import { useAbsenceDetail } from '../hooks/useAbsenceDetail';
import { AbsenceSummaryCards } from './AbsenceSummaryCards';
import { AbsenceCalendar } from './AbsenceCalendar';

interface AbsenceDetailPanelProps {
  patientId: string | null;
  period: AbsencePeriod;
  onPeriodChange: (period: AbsencePeriod) => void;
}

export function AbsenceDetailPanel({
  patientId,
  period,
  onPeriodChange,
}: AbsenceDetailPanelProps) {
  const { data, isLoading } = useAbsenceDetail(patientId, period);

  if (!patientId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center space-y-2">
          <UserX className="w-12 h-12 mx-auto text-gray-300" />
          <p className="text-sm">환자를 선택하면 결석 현황을 확인할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const riskConfig = RISK_CONFIG[data.summary.risk_level];

  const recentAbsences = data.daily_records
    .filter(r => r.scheduled && !r.attended && !r.is_holiday && !r.is_weekend)
    .slice(-10)
    .reverse();

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold">
              {getPatientDisplayName(data.patient)}
            </h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', riskConfig.badgeColor)}>
              {riskConfig.label}
            </span>
          </div>
          <div className="text-sm text-gray-500 space-y-0.5 mt-1">
            {data.patient.room_number && (
              <span className="mr-2">{data.patient.room_number}호</span>
            )}
            {data.patient.coordinator_name && (
              <span className="mr-2">{data.patient.coordinator_name}</span>
            )}
            {data.summary.schedule_pattern && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {data.summary.schedule_pattern}요일
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 flex-wrap">
          {PERIOD_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant="outline"
              size="sm"
              className={cn(
                'text-xs h-7 px-3',
                period === opt.value && 'bg-rose-100 text-rose-700 border-rose-300',
              )}
              onClick={() => onPeriodChange(opt.value as AbsencePeriod)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <AbsenceSummaryCards summary={data.summary} />

      <AbsenceCalendar dailyRecords={data.daily_records} />

      {recentAbsences.length > 0 && (
        <div className="bg-white rounded-lg border p-3 space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">최근 결석일</h4>
          <div className="space-y-1">
            {recentAbsences.map(record => (
              <div
                key={record.date}
                className="flex items-center justify-between py-1 border-b last:border-b-0"
              >
                <span className="text-sm text-gray-700">{record.date}</span>
                <span className="text-xs text-red-500 font-medium">결석</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        분석 기간: {PERIOD_OPTIONS.find(o => o.value === period)?.label} / 예정일 {data.summary.total_scheduled}일 기준
      </p>
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPatientDisplayName } from '@/lib/patient';
import { PERIOD_OPTIONS, type VitalsPeriod } from '../constants/vitals-ranges';
import { usePatientVitals } from '../hooks/usePatientVitals';
import { VitalsSummaryCards } from './VitalsSummaryCards';
import { BloodPressureChart } from './BloodPressureChart';
import { BloodSugarChart } from './BloodSugarChart';

interface VitalsDetailPanelProps {
  patientId: string | null;
  period: VitalsPeriod;
  onPeriodChange: (period: VitalsPeriod) => void;
}

export function VitalsDetailPanel({ patientId, period, onPeriodChange }: VitalsDetailPanelProps) {
  const { data, isLoading } = usePatientVitals(patientId, period);

  if (!patientId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center space-y-2">
          <HeartPulse className="w-12 h-12 mx-auto text-gray-300" />
          <p className="text-sm">환자를 선택하면 활력징후 데이터를 확인할 수 있습니다.</p>
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

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* 환자 정보 헤더 + 기간 선택 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">
            {getPatientDisplayName(data.patient)}
          </h3>
          {data.patient.room_number && (
            <span className="text-sm text-gray-500">{data.patient.room_number}호</span>
          )}
        </div>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant="outline"
              size="sm"
              className={cn(
                'text-xs h-7 px-3',
                period === opt.value && 'bg-purple-100 text-purple-700 border-purple-300'
              )}
              onClick={() => onPeriodChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 통계 카드 */}
      <VitalsSummaryCards
        stats={data.stats}
        records={data.records}
        latestBPStatus={data.latest_bp_status}
        latestBSStatus={data.latest_bs_status}
      />

      {/* 혈압 차트 */}
      <BloodPressureChart records={data.records} />

      {/* 혈당 차트 */}
      <BloodSugarChart records={data.records} />

      {/* 기록 수 표시 */}
      <p className="text-xs text-gray-400 text-center">
        표시된 기간: {data.records.length}건의 기록
      </p>
    </div>
  );
}

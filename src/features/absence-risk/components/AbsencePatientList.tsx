'use client';

import { useState, useMemo } from 'react';
import { RefreshCw, Search, User, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { matchesChosung } from '@/lib/chosung';
import { useKoreanSearchInput } from '@/hooks/useKoreanSearchInput';
import { getPatientDisplayName } from '@/lib/patient';
import { cn } from '@/lib/utils';
import {
  PERIOD_OPTIONS,
  RISK_CONFIG,
  TREND_CONFIG,
  type AbsencePeriod,
  type RiskLevel,
} from '../constants/risk-thresholds';
import type { AbsenceOverviewItem } from '../backend/schema';

type FilterTab = 'all' | 'high' | 'medium' | 'low';

interface AbsencePatientListProps {
  patients: AbsenceOverviewItem[];
  isLoading: boolean;
  selectedPatientId: string | null;
  onSelectPatient: (patientId: string) => void;
  onRefresh: () => void;
  period: AbsencePeriod;
  onPeriodChange: (period: AbsencePeriod) => void;
}

export function AbsencePatientList({
  patients,
  isLoading,
  selectedPatientId,
  onSelectPatient,
  onRefresh,
  period,
  onPeriodChange,
}: AbsencePatientListProps) {
  const { rawValue, searchQuery, inputProps, clear: clearSearch } = useKoreanSearchInput();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const counts = useMemo(() => {
    const high = patients.filter(p => p.risk_level === 'high').length;
    const medium = patients.filter(p => p.risk_level === 'medium').length;
    const low = patients.filter(p => p.risk_level === 'low').length;
    return { all: patients.length, high, medium, low };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    let result = patients;

    if (filterTab !== 'all') {
      result = result.filter(p => p.risk_level === filterTab);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      result = result.filter(
        p =>
          matchesChosung(p.name, query) ||
          (p.display_name && matchesChosung(p.display_name, query)),
      );
    }

    return result;
  }, [patients, filterTab, searchQuery]);

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: counts.all },
    { key: 'high', label: '위험', count: counts.high },
    { key: 'medium', label: '주의', count: counts.medium },
    { key: 'low', label: '정상', count: counts.low },
  ];

  function getTrendIcon(trend: string) {
    if (trend === 'declining') return TrendingDown;
    if (trend === 'improving') return TrendingUp;
    return Minus;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">결석 관리</h2>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={v => onPeriodChange(v as AbsencePeriod)}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="환자 검색 (초성 지원: ㄱㅅㅎ)"
            {...inputProps}
            className="pl-9 h-9"
          />
          {rawValue && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              onClick={clearSearch}
            >
              지우기
            </button>
          )}
        </div>

        <div className="flex gap-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              className={cn(
                'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
                filterTab === tab.key
                  ? 'bg-rose-100 text-rose-700'
                  : 'text-gray-500 hover:bg-gray-100',
              )}
              onClick={() => setFilterTab(tab.key)}
            >
              {tab.label}
              <span className="ml-1 text-[10px]">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="text-gray-500 text-center py-8 text-sm">로딩 중...</p>
        ) : filteredPatients.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-sm">
            {rawValue ? '검색 결과가 없습니다.' : '출석 일정이 있는 환자가 없습니다.'}
          </p>
        ) : (
          <div>
            {filteredPatients.map(patient => {
              const riskConfig = RISK_CONFIG[patient.risk_level as RiskLevel];
              const trendConfig = TREND_CONFIG[patient.trend as keyof typeof TREND_CONFIG];
              const TrendIcon = getTrendIcon(patient.trend);

              return (
                <button
                  key={patient.patient_id}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-l-4 transition-colors hover:bg-gray-50',
                    selectedPatientId === patient.patient_id
                      ? 'bg-rose-50 border-l-rose-500'
                      : riskConfig.borderColor,
                  )}
                  onClick={() => onSelectPatient(patient.patient_id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate">
                            {getPatientDisplayName(patient)}
                          </span>
                          {patient.room_number && (
                            <span className="text-xs text-gray-400">{patient.room_number}호</span>
                          )}
                        </div>
                        {patient.coordinator_name && (
                          <span className="text-xs text-gray-400 block">
                            {patient.coordinator_name}
                          </span>
                        )}
                        {patient.last_attended_date && (
                          <span className="text-xs text-gray-400 block">
                            마지막 출석: {patient.last_attended_date}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge
                        className={cn('text-[10px] px-1.5 py-0 border-0', riskConfig.badgeColor)}
                      >
                        {riskConfig.label}
                      </Badge>
                      {patient.consecutive_absences > 0 && (
                        <span className="text-[10px] text-red-500 font-medium">
                          연속 {patient.consecutive_absences}일 결석
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">
                        출석률 {patient.attendance_rate}%
                      </span>
                      <TrendIcon className={cn('w-3 h-3', trendConfig.color)} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { matchesChosung } from '@/lib/chosung';
import { useKoreanSearchInput } from '@/hooks/useKoreanSearchInput';
import { cn } from '@/lib/utils';
import { getPatientDisplayName } from '@/lib/patient';
import { BP_CONFIG, BS_CONFIG } from '../constants/vitals-ranges';
import type { VitalsOverviewItem } from '../backend/schema';
import type { BPClassification, BSClassification } from '../constants/vitals-ranges';

type FilterTab = 'all' | 'abnormal' | 'normal';

interface VitalsPatientListProps {
  patients: VitalsOverviewItem[];
  isLoading: boolean;
  selectedPatientId: string | null;
  onSelectPatient: (patientId: string) => void;
  onRefresh: () => void;
}

export function VitalsPatientList({
  patients,
  isLoading,
  selectedPatientId,
  onSelectPatient,
  onRefresh,
}: VitalsPatientListProps) {
  const { rawValue, searchQuery, inputProps, clear: clearSearch } = useKoreanSearchInput();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const counts = useMemo(() => {
    const abnormal = patients.filter(p => p.has_abnormal).length;
    return { all: patients.length, abnormal, normal: patients.length - abnormal };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    let result = patients;

    if (filterTab === 'abnormal') {
      result = result.filter(p => p.has_abnormal);
    } else if (filterTab === 'normal') {
      result = result.filter(p => !p.has_abnormal);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      result = result.filter(p =>
        matchesChosung(p.name, query) ||
        (p.display_name && matchesChosung(p.display_name, query))
      );
    }

    return result;
  }, [patients, filterTab, searchQuery]);

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: counts.all },
    { key: 'abnormal', label: '주의필요', count: counts.abnormal },
    { key: 'normal', label: '정상', count: counts.normal },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">활력징후 모니터링</h2>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
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
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-500 hover:bg-gray-100'
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
            {rawValue ? '검색 결과가 없습니다.' : '활력징후 데이터가 있는 환자가 없습니다.'}
          </p>
        ) : (
          <div>
            {filteredPatients.map((patient) => (
              <button
                key={patient.patient_id}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-l-4 transition-colors hover:bg-gray-50',
                  selectedPatientId === patient.patient_id
                    ? 'bg-purple-50 border-l-purple-500'
                    : patient.has_abnormal
                      ? 'border-l-red-400 bg-red-50/30'
                      : 'border-l-green-400 bg-green-50/20'
                )}
                onClick={() => onSelectPatient(patient.patient_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
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
                        <span className="text-xs text-gray-400">{patient.coordinator_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    {patient.latest_systolic !== null && patient.latest_diastolic !== null && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px] px-1.5 py-0',
                          patient.bp_status
                            ? `${BP_CONFIG[patient.bp_status as BPClassification]?.bgColor} ${BP_CONFIG[patient.bp_status as BPClassification]?.color}`
                            : 'bg-gray-50 text-gray-500'
                        )}
                      >
                        {patient.latest_systolic}/{patient.latest_diastolic}
                      </Badge>
                    )}
                    {patient.latest_blood_sugar !== null && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px] px-1.5 py-0',
                          patient.bs_status
                            ? `${BS_CONFIG[patient.bs_status as BSClassification]?.bgColor} ${BS_CONFIG[patient.bs_status as BSClassification]?.color}`
                            : 'bg-gray-50 text-gray-500'
                        )}
                      >
                        혈당 {patient.latest_blood_sugar}
                      </Badge>
                    )}
                    {patient.has_abnormal ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-500">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        주의
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] text-green-500">
                        <CheckCircle className="w-2.5 h-2.5" />
                        정상
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, User, Check, Clock, AlertCircle, Bell } from 'lucide-react';
import { matchesChosung } from '@/lib/chosung';
import { useKoreanSearchInput } from '@/hooks/useKoreanSearchInput';
import { cn } from '@/lib/utils';
import type { NursePatientSummary } from '@/features/nurse/backend/schema';

type FilterTab = 'all' | 'pending' | 'completed';

interface AdminPatientListPanelProps {
  patients: NursePatientSummary[];
  isLoading: boolean;
  selectedPatientId: string | null;
  onSelectPatient: (patient: NursePatientSummary) => void;
  onRefresh: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function AdminPatientListPanel({
  patients,
  isLoading,
  selectedPatientId,
  onSelectPatient,
  onRefresh,
  searchInputRef,
}: AdminPatientListPanelProps) {
  const { rawValue, searchQuery, inputProps, clear: clearSearch } = useKoreanSearchInput();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const counts = useMemo(() => {
    const pending = patients.filter(p => p.has_nurse_task && !p.task_completed).length;
    const completed = patients.filter(p => !p.has_nurse_task || p.task_completed).length;
    return { all: patients.length, pending, completed };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    let result = patients;

    if (filterTab === 'pending') {
      result = result.filter(p => p.has_nurse_task && !p.task_completed);
    } else if (filterTab === 'completed') {
      result = result.filter(p => !p.has_nurse_task || p.task_completed);
    }

    if (searchQuery.trim()) {
      result = result.filter(p => matchesChosung(p.name, searchQuery.trim()));
    }

    result = [...result].sort((a, b) => {
      const aTask = a.has_nurse_task && !a.task_completed ? 0 : 1;
      const bTask = b.has_nurse_task && !b.task_completed ? 0 : 1;
      if (aTask !== bTask) return aTask - bTask;

      const aAttended = a.is_attended ? 0 : 1;
      const bAttended = b.is_attended ? 0 : 1;
      if (aAttended !== bAttended) return aAttended - bAttended;

      return a.name.localeCompare(b.name);
    });

    return result;
  }, [patients, filterTab, searchQuery]);

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: counts.all },
    { key: 'pending', label: '미처리', count: counts.pending },
    { key: 'completed', label: '완료', count: counts.completed },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">대시보드</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={searchInputRef}
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
                  ? 'bg-indigo-100 text-indigo-700'
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

      {/* 키보드 단축키 힌트 */}
      <div className="text-[10px] text-gray-400 px-4 py-1 border-b">
        <kbd className="px-1 bg-gray-100 rounded">↑↓</kbd> 이동 &middot; <kbd className="px-1 bg-gray-100 rounded">/</kbd> 검색 &middot; <kbd className="px-1 bg-gray-100 rounded">Ctrl+S</kbd> 저장
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="text-gray-500 text-center py-8 text-sm">로딩 중...</p>
        ) : filteredPatients.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-sm">
            {rawValue ? '검색 결과가 없습니다.' : '환자가 없습니다.'}
          </p>
        ) : (
          <div>
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-l-4 transition-colors hover:bg-gray-50',
                  selectedPatientId === patient.id
                    ? 'bg-indigo-50 border-l-indigo-500'
                    : patient.has_nurse_task && !patient.task_completed
                      ? 'border-l-orange-400 bg-orange-50/30'
                      : patient.is_consulted
                        ? 'border-l-green-400 bg-green-50/30'
                        : patient.is_attended
                          ? 'border-l-transparent'
                          : patient.is_scheduled
                            ? 'border-l-red-400 bg-red-50/30'
                            : 'border-l-gray-200'
                )}
                onClick={() => onSelectPatient(patient)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">{patient.name}</span>
                        <span className="text-xs text-gray-400">
                          {patient.gender === 'M' ? '남' : patient.gender === 'F' ? '여' : ''}
                        </span>
                      </div>
                      {patient.coordinator_name && (
                        <span className="text-xs text-gray-400">
                          {patient.coordinator_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {patient.is_attended ? (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0">
                        <Check className="w-2.5 h-2.5 mr-0.5" />
                        출석
                      </Badge>
                    ) : patient.is_scheduled ? (
                      <Badge variant="secondary" className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                        미출석
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-50 text-gray-400 text-[10px] px-1.5 py-0">
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        미예정
                      </Badge>
                    )}
                    {patient.is_consulted && (
                      <Badge variant="secondary" className="bg-green-50 text-green-600 text-[10px] px-1.5 py-0">
                        <Check className="w-2.5 h-2.5 mr-0.5" />
                        진찰
                      </Badge>
                    )}
                    {patient.has_nurse_task && !patient.task_completed && (
                      <Badge variant="secondary" className="bg-orange-50 text-orange-600 text-[10px] px-1.5 py-0">
                        <Bell className="w-2.5 h-2.5 mr-0.5" />
                        지시
                      </Badge>
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

'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, User, Check, Clock, Bell } from 'lucide-react';
import { matchesChosung } from '@/lib/chosung';
import { cn } from '@/lib/utils';
import type { PatientSummary } from '../backend/schema';

type FilterTab = 'all' | 'pending' | 'completed';

interface StaffPatientListPanelProps {
  patients: PatientSummary[];
  isLoading: boolean;
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
  selectedPatientId: string | null;
  onSelectPatient: (patient: PatientSummary) => void;
  onRefresh: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function StaffPatientListPanel({
  patients,
  isLoading,
  showAll,
  onShowAllChange,
  selectedPatientId,
  onSelectPatient,
  onRefresh,
  searchInputRef,
}: StaffPatientListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const counts = useMemo(() => {
    const pending = patients.filter(p => p.has_task && !p.task_completed).length;
    const completed = patients.filter(p => !p.has_task || p.task_completed).length;
    return { all: patients.length, pending, completed };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    let result = patients;

    if (filterTab === 'pending') {
      result = result.filter(p => p.has_task && !p.task_completed);
    } else if (filterTab === 'completed') {
      result = result.filter(p => !p.has_task || p.task_completed);
    }

    if (searchQuery.trim()) {
      result = result.filter(p => matchesChosung(p.name, searchQuery.trim()));
    }

    result = [...result].sort((a, b) => {
      const aTask = a.has_task && !a.task_completed ? 0 : 1;
      const bTask = b.has_task && !b.task_completed ? 0 : 1;
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
      {/* 헤더 */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">환자 관리</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        {/* 담당/전체 토글 */}
        <div className="flex gap-1">
          <button
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              !showAll ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'
            )}
            onClick={() => onShowAllChange(false)}
          >
            담당 환자
          </button>
          <button
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              showAll ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'
            )}
            onClick={() => onShowAllChange(true)}
          >
            전체 환자
          </button>
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            placeholder="환자 검색 (초성 지원: ㄱㅅㅎ)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              onClick={() => setSearchQuery('')}
            >
              지우기
            </button>
          )}
        </div>

        {/* 상태 필터 탭 */}
        <div className="flex gap-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              className={cn(
                'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
                filterTab === tab.key
                  ? 'bg-emerald-100 text-emerald-700'
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

      {/* 환자 목록 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="text-gray-500 text-center py-8 text-sm">로딩 중...</p>
        ) : filteredPatients.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-sm">
            {searchQuery ? '검색 결과가 없습니다.' : '환자가 없습니다.'}
          </p>
        ) : (
          <div>
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-l-4 transition-colors hover:bg-gray-50',
                  selectedPatientId === patient.id
                    ? 'bg-emerald-50 border-l-emerald-500'
                    : patient.has_task && !patient.task_completed
                      ? 'border-l-orange-400 bg-orange-50/30'
                      : patient.is_consulted
                        ? 'border-l-green-400 bg-green-50/30'
                        : patient.is_attended
                          ? 'border-l-transparent'
                          : 'border-l-gray-200'
                )}
                onClick={() => onSelectPatient(patient)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <span className="font-medium text-sm truncate">{patient.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {patient.is_attended ? (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0">
                        <Check className="w-2.5 h-2.5 mr-0.5" />
                        출석
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-50 text-gray-400 text-[10px] px-1.5 py-0">
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        미출석
                      </Badge>
                    )}
                    {patient.is_consulted && (
                      <Badge variant="secondary" className="bg-green-50 text-green-600 text-[10px] px-1.5 py-0">
                        <Check className="w-2.5 h-2.5 mr-0.5" />
                        진찰
                      </Badge>
                    )}
                    {patient.has_task && !patient.task_completed && (
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

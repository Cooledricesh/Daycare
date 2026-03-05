'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, RefreshCw, User, Check, Clock, AlertCircle, Bell, UserCheck } from 'lucide-react';
import { matchesChosung } from '@/lib/chosung';
import { useKoreanSearchInput } from '@/hooks/useKoreanSearchInput';
import { cn } from '@/lib/utils';
import type { PatientSummary } from '../backend/schema';

type FilterTab = 'all' | 'scheduled' | 'completed';

interface StaffPatientListPanelProps {
  patients: PatientSummary[];
  isLoading: boolean;
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
  selectedPatientId: string | null;
  onSelectPatient: (patient: PatientSummary) => void;
  onRefresh: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  attendanceMode: boolean;
  onAttendanceModeChange: (mode: boolean) => void;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  cancelIds: Set<string>;
  onCancelIdsChange: (ids: Set<string>) => void;
  onBatchAttendance: () => void;
  isBatchLoading: boolean;
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
  attendanceMode,
  onAttendanceModeChange,
  selectedIds,
  onSelectedIdsChange,
  cancelIds,
  onCancelIdsChange,
  onBatchAttendance,
  isBatchLoading,
}: StaffPatientListPanelProps) {
  const { rawValue, searchQuery, inputProps, clear: clearSearch } = useKoreanSearchInput();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const counts = useMemo(() => {
    const scheduled = patients.filter(p => p.is_scheduled).length;
    const completed = patients.filter(p => p.is_consulted).length;
    return { all: patients.length, scheduled, completed };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    let result = patients;

    if (filterTab === 'scheduled') {
      result = result.filter(p => p.is_scheduled);
    } else if (filterTab === 'completed') {
      result = result.filter(p => p.is_consulted);
    }

    if (searchQuery.trim()) {
      result = result.filter(p => matchesChosung(p.name, searchQuery.trim()));
    }

    // 정렬 그룹: 0=지시/전달, 1=출석(미진찰), 2=예정(미출석), 3=진찰완료, 4=미예정
    result = [...result].sort((a, b) => {
      const group = (p: PatientSummary) => {
        const hasAction = (p.has_task && !p.task_completed) || p.unread_message_count > 0;
        if (hasAction) return 0;
        if (p.is_attended && !p.is_consulted) return 1;
        if (p.is_consulted) return 3;
        if (!p.is_scheduled) return 4;
        return 2;
      };
      const diff = group(a) - group(b);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [patients, filterTab, searchQuery]);

  // 미출석 환자 목록
  const unattendedPatients = useMemo(
    () => filteredPatients.filter(p => !p.is_attended),
    [filteredPatients],
  );

  const allUnattendedSelected = unattendedPatients.length > 0 &&
    unattendedPatients.every(p => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allUnattendedSelected) {
      onSelectedIdsChange(new Set());
    } else {
      onSelectedIdsChange(new Set(unattendedPatients.map(p => p.id)));
    }
  };

  const togglePatient = (patient: PatientSummary) => {
    if (patient.is_attended) {
      // 출석한 환자: cancelIds 토글
      const next = new Set(cancelIds);
      if (next.has(patient.id)) {
        next.delete(patient.id);
      } else {
        next.add(patient.id);
      }
      onCancelIdsChange(next);
    } else {
      // 미출석 환자: selectedIds 토글
      const next = new Set(selectedIds);
      if (next.has(patient.id)) {
        next.delete(patient.id);
      } else {
        next.add(patient.id);
      }
      onSelectedIdsChange(next);
    }
  };

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: counts.all },
    { key: 'scheduled', label: '예정', count: counts.scheduled },
    { key: 'completed', label: '완료', count: counts.completed },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">환자 관리</h2>
          <div className="flex items-center gap-1">
            <Button
              variant={attendanceMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                onAttendanceModeChange(!attendanceMode);
                onSelectedIdsChange(new Set());
                onCancelIdsChange(new Set());
              }}
              className="text-xs"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1" />
              출석 체크
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
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

      {/* 출석 체크 모드: 전체 선택 */}
      {attendanceMode && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-blue-50/50">
          <Checkbox
            checked={allUnattendedSelected}
            onCheckedChange={toggleSelectAll}
            disabled={unattendedPatients.length === 0}
          />
          <span className="text-xs text-gray-600">
            미출석 전체 선택 ({unattendedPatients.length}명)
          </span>
        </div>
      )}

      {/* 키보드 단축키 힌트 */}
      {!attendanceMode && (
        <div className="text-[10px] text-gray-400 px-4 py-1 border-b">
          <kbd className="px-1 bg-gray-100 rounded">↑↓</kbd> 이동 &middot; <kbd className="px-1 bg-gray-100 rounded">/</kbd> 검색 &middot; <kbd className="px-1 bg-gray-100 rounded">Ctrl+S</kbd> 저장
        </div>
      )}

      {/* 환자 목록 */}
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
              <div
                role="button"
                tabIndex={0}
                key={patient.id}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-l-4 transition-colors hover:bg-gray-50 cursor-pointer',
                  attendanceMode && selectedIds.has(patient.id) && !patient.is_attended
                    ? 'bg-blue-50 border-l-blue-500'
                    : attendanceMode && cancelIds.has(patient.id) && patient.is_attended
                      ? 'bg-red-50 border-l-red-500'
                      : selectedPatientId === patient.id && !attendanceMode
                        ? 'bg-emerald-50 border-l-emerald-500'
                        : patient.has_task && !patient.task_completed
                          ? 'border-l-orange-400 bg-orange-50/30'
                          : patient.is_consulted
                            ? 'border-l-green-400 bg-green-50/30'
                            : patient.is_attended
                              ? 'border-l-transparent'
                              : patient.is_scheduled
                                ? 'border-l-red-400 bg-red-50/30'
                                : 'border-l-gray-200'
                )}
                onClick={() => {
                  if (attendanceMode) {
                    togglePatient(patient);
                  } else {
                    onSelectPatient(patient);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {attendanceMode ? (
                      <Checkbox
                        checked={
                          patient.is_attended
                            ? !cancelIds.has(patient.id)
                            : selectedIds.has(patient.id)
                        }
                        onCheckedChange={() => togglePatient(patient)}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-sm truncate">{patient.name}</span>
                      <span className="text-xs text-gray-400">
                        {patient.gender === 'M' ? '남' : patient.gender === 'F' ? '여' : ''}
                      </span>
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
                    {!attendanceMode && patient.is_consulted && (
                      <Badge variant="secondary" className="bg-green-50 text-green-600 text-[10px] px-1.5 py-0">
                        <Check className="w-2.5 h-2.5 mr-0.5" />
                        진찰
                      </Badge>
                    )}
                    {!attendanceMode && patient.has_task && !patient.task_completed && (
                      <Badge variant="secondary" className="bg-orange-50 text-orange-600 text-[10px] px-1.5 py-0">
                        <Bell className="w-2.5 h-2.5 mr-0.5" />
                        지시
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 플로팅 액션바 */}
      {attendanceMode && (selectedIds.size > 0 || cancelIds.size > 0) && (
        <div className="p-3 border-t bg-white shadow-lg">
          <Button
            className="w-full"
            onClick={onBatchAttendance}
            disabled={isBatchLoading}
          >
            {isBatchLoading
              ? '처리 중...'
              : [
                  selectedIds.size > 0 && `${selectedIds.size}명 출석`,
                  cancelIds.size > 0 && `${cancelIds.size}명 취소`,
                ]
                  .filter(Boolean)
                  .join(' / ')}
          </Button>
        </div>
      )}
    </div>
  );
}

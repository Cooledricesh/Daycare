'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, User, Check, Clock, MessageSquare } from 'lucide-react';
import { matchesChosung } from '@/lib/chosung';
import { cn } from '@/lib/utils';
import type { WaitingPatient } from '../backend/schema';

type FilterTab = 'all' | 'waiting' | 'completed';

interface PatientListPanelProps {
  patients: WaitingPatient[];
  isLoading: boolean;
  selectedPatientId: string | null;
  onSelectPatient: (patient: WaitingPatient) => void;
  onRefresh: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function PatientListPanel({
  patients,
  isLoading,
  selectedPatientId,
  onSelectPatient,
  onRefresh,
  searchInputRef,
}: PatientListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  // 카운트 계산
  const counts = useMemo(() => {
    const waiting = patients.filter(p => !p.has_consultation).length;
    const completed = patients.filter(p => p.has_consultation).length;
    return { all: patients.length, waiting, completed };
  }, [patients]);

  // 필터링 + 검색 + 정렬
  const filteredPatients = useMemo(() => {
    let result = patients;

    // 필터 탭 적용
    if (filterTab === 'waiting') {
      result = result.filter(p => !p.has_consultation);
    } else if (filterTab === 'completed') {
      result = result.filter(p => p.has_consultation);
    }

    // 검색어 필터링
    if (searchQuery.trim()) {
      result = result.filter(p => matchesChosung(p.name, searchQuery.trim()));
    }

    // 정렬: 출석 → 미출석, 그 안에서 대기 → 완료
    result = [...result].sort((a, b) => {
      // 출석 여부 (출석 먼저)
      const aAttended = a.checked_at ? 0 : 1;
      const bAttended = b.checked_at ? 0 : 1;
      if (aAttended !== bAttended) return aAttended - bAttended;

      // 진찰 완료 여부 (대기 먼저)
      const aConsulted = a.has_consultation ? 1 : 0;
      const bConsulted = b.has_consultation ? 1 : 0;
      if (aConsulted !== bConsulted) return aConsulted - bConsulted;

      // 호실 순
      return (a.room_number || '').localeCompare(b.room_number || '');
    });

    return result;
  }, [patients, filterTab, searchQuery]);

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: counts.all },
    { key: 'waiting', label: '대기', count: counts.waiting },
    { key: 'completed', label: '완료', count: counts.completed },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">진료실</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
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

        {/* 필터 탭 */}
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
                    ? 'bg-purple-50 border-l-purple-500'
                    : patient.has_consultation
                      ? 'border-l-green-400 bg-green-50/30'
                      : patient.checked_at
                        ? 'border-l-transparent'
                        : 'border-l-yellow-400 bg-yellow-50/30'
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
                      <span className="text-xs text-gray-500">
                        {patient.room_number ? `${patient.room_number}호` : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* 출석 상태 */}
                    {patient.checked_at ? (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0">
                        <Check className="w-2.5 h-2.5 mr-0.5" />
                        출석
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-yellow-50 text-yellow-600 text-[10px] px-1.5 py-0">
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        미출석
                      </Badge>
                    )}
                    {/* 진찰 완료 */}
                    {patient.has_consultation && (
                      <Badge variant="secondary" className="bg-green-50 text-green-600 text-[10px] px-1.5 py-0">
                        <Check className="w-2.5 h-2.5 mr-0.5" />
                        진찰
                      </Badge>
                    )}
                    {/* 미확인 메시지 */}
                    {patient.unread_message_count > 0 && (
                      <Badge variant="secondary" className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0">
                        <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
                        {patient.unread_message_count}
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

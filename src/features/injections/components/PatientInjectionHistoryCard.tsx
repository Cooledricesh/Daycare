'use client';

import { useState } from 'react';
import { Syringe, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePatientInjectionHistory } from '../hooks/usePatientInjectionHistory';
import type { InjectionHistoryItem } from '../lib/dto';

const URGENCY_DAYS = 7;
const COLLAPSED_COUNT = 3;

type Props = { patientId: string; className?: string };

function formatDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return format(parsed, 'yyyy-MM-dd (EEE)', { locale: ko });
}

function daysUntil(dateStr: string): number | null {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function dueBadge(dateStr: string | null) {
  if (!dateStr) return <Badge variant="secondary">예정 없음</Badge>;
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">지남 {Math.abs(days)}일</Badge>;
  if (days === 0) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">오늘</Badge>;
  if (days <= URGENCY_DAYS) return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">D-{days}</Badge>;
  return <Badge variant="secondary">D-{days}</Badge>;
}

function HistoryItemBlock({ item }: { item: InjectionHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? item.history : item.history.slice(0, COLLAPSED_COUNT);
  const hasMore = item.history.length > COLLAPSED_COUNT;

  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{item.item_name}</span>
          <span className="text-xs text-gray-500 whitespace-nowrap">총 {item.total_doses}회차</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-xs text-gray-500">다음: {item.next_due_date ? formatDate(item.next_due_date) : '-'}</span>
          {dueBadge(item.next_due_date)}
        </div>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {visible.map((h) => (
          <li key={`${item.item_name}-${h.dose_seq}`} className="text-xs text-gray-600 flex items-center gap-2">
            <span className="inline-flex items-center justify-center min-w-[2.2rem] px-1 rounded bg-purple-50 text-purple-700 font-semibold">
              {h.dose_seq}차
            </span>
            <span>{formatDate(h.executed_date)}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-purple-600 inline-flex items-center gap-0.5"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" /> 접기
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" /> 이력 {item.history.length}건 전체보기
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function PatientInjectionHistoryCard({ patientId, className }: Props) {
  const { data, isLoading, isError } = usePatientInjectionHistory(patientId);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Syringe className="w-4 h-4 text-purple-600" />
          주사제 이력
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : isError || !data ? (
          <p className="text-sm text-gray-400">주사제 정보를 불러오지 못했습니다.</p>
        ) : !data.upstream_available ? (
          <p className="text-sm text-gray-400">Carescheduler 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>
        ) : data.injections.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 장기지속형 주사제 이력이 없습니다.</p>
        ) : (
          <div className="divide-y">
            {data.injections.map((item) => (
              <HistoryItemBlock key={item.item_name} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

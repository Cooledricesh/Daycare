'use client';

import { Syringe } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePatientInjections } from '../hooks/usePatientInjections';
import type { PatientInjection } from '../lib/dto';

const URGENCY_DAYS = 7;

const CARESCHEDULER_WEB_URL =
  process.env.NEXT_PUBLIC_CARESCHEDULER_WEB_URL ?? 'https://careschedulerp.vercel.app';

type Props = {
  patientId: string;
  className?: string;
};

function formatDueLabel(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateStr;
  }
  return format(parsed, 'yyyy-MM-dd (EEE)', { locale: ko });
}

function daysUntil(dateStr: string): number | null {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = parsed.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function urgencyBadge(dateStr: string) {
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">지남 {Math.abs(days)}일</Badge>;
  }
  if (days === 0) {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">오늘</Badge>;
  }
  if (days <= URGENCY_DAYS) {
    return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">D-{days}</Badge>;
  }
  return <Badge variant="secondary">D-{days}</Badge>;
}

function InjectionRow({ injection }: { injection: PatientInjection }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{injection.item_name}</span>
          {urgencyBadge(injection.next_due_date)}
        </div>
        <div className="mt-1 text-xs text-gray-500 space-x-2">
          <span>다음: {formatDueLabel(injection.next_due_date)}</span>
          {injection.last_executed_date ? (
            <span>• 지난 투여: {injection.last_executed_date}</span>
          ) : (
            <span>• 지난 투여 기록 없음</span>
          )}
          <span>• 간격 {injection.interval_weeks}주</span>
        </div>
      </div>
    </div>
  );
}

export function PatientInjectionsCard({ patientId, className }: Props) {
  const { data, isLoading, isError } = usePatientInjections(patientId);

  const careschedulerLink = CARESCHEDULER_WEB_URL;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Syringe className="w-4 h-4 text-purple-600" />
          장기지속형 주사제
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="text-xs text-gray-500">
          <a href={careschedulerLink} target="_blank" rel="noopener noreferrer">
            Carescheduler 열기 ↗
          </a>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : isError || !data ? (
          <p className="text-sm text-gray-400">주사제 정보를 불러오지 못했습니다.</p>
        ) : !data.upstream_available ? (
          <p className="text-sm text-gray-400">
            Carescheduler 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : data.injections.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 장기지속형 주사제 스케줄이 없습니다.</p>
        ) : (
          <div className="divide-y">
            {data.injections.map((injection, index) => (
              <InjectionRow key={`${injection.item_name}-${index}`} injection={injection} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

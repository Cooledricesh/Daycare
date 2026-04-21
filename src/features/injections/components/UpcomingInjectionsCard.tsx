'use client';

import Link from 'next/link';
import { Syringe, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUpcomingInjections } from '../hooks/useUpcomingInjections';
import type { UpcomingInjectionItem } from '../lib/dto';

const DEFAULT_DAYS = 7;
const MAX_VISIBLE_ITEMS = 10;

type Props = {
  patientLinkPrefix: string;
  days?: number;
  className?: string;
};

function dueLabel(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return format(parsed, 'M/d (EEE)', { locale: ko });
}

function daysUntil(dateStr: string): number | null {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
  if (days <= 2) {
    return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">D-{days}</Badge>;
  }
  return <Badge variant="secondary">D-{days}</Badge>;
}

function Row({
  item,
  patientLinkPrefix,
}: {
  item: UpcomingInjectionItem;
  patientLinkPrefix: string;
}) {
  const rowContent = (
    <div className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-gray-50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{item.patient_name}</span>
          {urgencyBadge(item.next_due_date)}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {dueLabel(item.next_due_date)} · {item.item_name}
        </div>
      </div>
      {item.patient_id && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />}
    </div>
  );

  if (item.patient_id) {
    return (
      <Link href={`${patientLinkPrefix}/${item.patient_id}`} className="block">
        {rowContent}
      </Link>
    );
  }

  return <div>{rowContent}</div>;
}

export function UpcomingInjectionsCard({ patientLinkPrefix, days = DEFAULT_DAYS, className }: Props) {
  const { data, isLoading, isError } = useUpcomingInjections(days);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Syringe className="w-3.5 h-3.5 text-purple-600" />
          주사제 예정 ({days}일 내)
          {data && data.count > 0 && (
            <span className="text-gray-400 text-xs font-normal">· {data.count}건</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {isLoading ? (
          <p className="text-xs text-gray-400">불러오는 중...</p>
        ) : isError || !data ? (
          <p className="text-xs text-gray-400">주사제 정보를 불러오지 못했습니다.</p>
        ) : !data.upstream_available ? (
          <p className="text-xs text-gray-400">
            Carescheduler 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : data.items.length === 0 ? (
          <p className="text-xs text-gray-500">
            다가오는 {days}일 내 예정된 주사제가 없습니다.
          </p>
        ) : (
          <div className="space-y-0.5">
            {data.items.slice(0, MAX_VISIBLE_ITEMS).map((item, index) => (
              <Row
                key={`${item.patient_id_no}-${item.item_name}-${index}`}
                item={item}
                patientLinkPrefix={patientLinkPrefix}
              />
            ))}
            {data.items.length > MAX_VISIBLE_ITEMS && (
              <p className="text-[11px] text-gray-400 pt-1">
                + {data.items.length - MAX_VISIBLE_ITEMS}건 더
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import Link from 'next/link';
import { Syringe } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUpcomingInjections } from '../hooks/useUpcomingInjections';
import type { UpcomingInjectionItem } from '../lib/dto';

const DEFAULT_DAYS = 7;

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

function dueSuffix(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days === null) return dueLabel(dateStr);
  if (days < 0) return `지남 ${Math.abs(days)}일`;
  if (days === 0) return '오늘';
  if (days === 1) return '내일';
  return `D-${days}`;
}

function InjectionBadge({
  item,
  patientLinkPrefix,
}: {
  item: UpcomingInjectionItem;
  patientLinkPrefix: string;
}) {
  const tooltip = `${item.item_name} · ${dueLabel(item.next_due_date)}`;

  const badge = (
    <Badge
      variant="outline"
      className="cursor-pointer hover:bg-gray-50 text-purple-600 border-current"
      title={tooltip}
    >
      {item.patient_name}
      <span className="ml-1 text-[10px] opacity-60">{dueSuffix(item.next_due_date)}</span>
    </Badge>
  );

  if (item.patient_id) {
    return <Link href={`${patientLinkPrefix}/${item.patient_id}`}>{badge}</Link>;
  }
  return <span>{badge}</span>;
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
          <div className="flex flex-wrap gap-1">
            {data.items.map((item, index) => (
              <InjectionBadge
                key={`${item.patient_id_no}-${item.item_name}-${index}`}
                item={item}
                patientLinkPrefix={patientLinkPrefix}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

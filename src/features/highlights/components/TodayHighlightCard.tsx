'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertTriangle, AlertCircle, Stethoscope, Cake, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTodayHighlights } from '../hooks/useTodayHighlights';
import type { HighlightPatient } from '../lib/dto';

interface Props {
  patientLinkPrefix: string; // 예: "/dashboard/nurse/patient" 또는 "/dashboard/staff/patient"
  className?: string;
}

interface EventGroupProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  patients: HighlightPatient[];
  linkPrefix: string;
}

function EventGroup({ title, icon, color, patients, linkPrefix }: EventGroupProps) {
  if (patients.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className={cn('flex items-center gap-1 text-xs font-medium', color)}>
        {icon}
        {title}
        <span className="text-gray-400">({patients.length})</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {patients.map((p) => (
          <Link key={p.id} href={`${linkPrefix}/${p.id}`}>
            <Badge
              variant="outline"
              className={cn('cursor-pointer hover:bg-gray-50', color, 'border-current')}
            >
              {p.display_name || p.name}
              {p.room_number && <span className="ml-1 text-[10px] opacity-60">{p.room_number}</span>}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function TodayHighlightCard({ patientLinkPrefix, className }: Props) {
  const { data, isLoading, isError } = useTodayHighlights();

  return (
    <Card className={className}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          오늘의 하이라이트
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        {isLoading ? (
          <p className="text-xs text-gray-400 text-center py-2">불러오는 중...</p>
        ) : isError || !data ? (
          <p className="text-xs text-red-400 text-center py-2">불러오지 못했습니다</p>
        ) : (
          <>
            <EventGroup
              title="3일 연속 결석"
              icon={<AlertTriangle className="w-3 h-3" />}
              color="text-amber-600"
              patients={data.events.threeDayAbsence}
              linkPrefix={patientLinkPrefix}
            />
            <EventGroup
              title="갑작스런 결석"
              icon={<AlertCircle className="w-3 h-3" />}
              color="text-red-600"
              patients={data.events.suddenAbsence}
              linkPrefix={patientLinkPrefix}
            />
            <EventGroup
              title="진찰 누락"
              icon={<Stethoscope className="w-3 h-3" />}
              color="text-blue-600"
              patients={data.events.examMissed}
              linkPrefix={patientLinkPrefix}
            />
            <EventGroup
              title="오늘 생일"
              icon={<Cake className="w-3 h-3" />}
              color="text-pink-600"
              patients={data.events.birthdays}
              linkPrefix={patientLinkPrefix}
            />
            <EventGroup
              title="신규 등록"
              icon={<UserPlus className="w-3 h-3" />}
              color="text-emerald-600"
              patients={data.events.newlyRegistered}
              linkPrefix={patientLinkPrefix}
            />
            {Object.values(data.events).every((arr) => arr.length === 0) && (
              <p className="text-xs text-gray-400 text-center py-2">오늘은 특이사항이 없습니다</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

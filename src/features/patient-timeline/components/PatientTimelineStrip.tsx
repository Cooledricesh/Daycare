'use client';

import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Check,
  Stethoscope,
  MessageSquare,
  X,
  LogIn,
  LogOut,
  Cake,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePatientTimeline } from '../hooks/usePatientTimeline';
import type { TimelineEvent, TimelineEventType } from '../lib/dto';

interface Props {
  patientId: string;
  className?: string;
}

const ICON_MAP: Record<TimelineEventType, React.ComponentType<{ className?: string }>> = {
  attendance: Check,
  consultation: Stethoscope,
  message: MessageSquare,
  absence: X,
  admission: LogIn,
  discharge: LogOut,
  birthday: Cake,
};

const COLOR_MAP: Record<TimelineEventType, string> = {
  attendance: 'text-emerald-600 bg-emerald-50',
  consultation: 'text-blue-600 bg-blue-50',
  message: 'text-slate-600 bg-slate-50',
  absence: 'text-red-600 bg-red-50',
  admission: 'text-green-700 bg-green-100',
  discharge: 'text-gray-600 bg-gray-100',
  birthday: 'text-pink-600 bg-pink-50',
};

function groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const map = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return map;
}

export function PatientTimelineStrip({ patientId, className }: Props) {
  const { data, isLoading, isError } = usePatientTimeline(patientId);

  const handleClick = useCallback((date: string) => {
    const el = document.querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-300');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-300');
      }, 1500);
    }
  }, []);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            타임라인 요약
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) return null;

  const groups = groupByDate(data.events);
  const sortedDates = Array.from(groups.keys()).sort();

  return (
    <Card className={className}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          타임라인 요약
          <span className="text-[10px] text-gray-400 font-normal ml-1">
            ({data.range.startDate} ~ {data.range.endDate})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {sortedDates.map((date) => {
              const events = groups.get(date)!;
              return (
                <button
                  key={date}
                  type="button"
                  className="flex flex-col items-center gap-0.5 p-1 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => handleClick(date)}
                  title={`${date} — ${events.map((e) => e.label).join(', ')}`}
                >
                  <div className="flex flex-col gap-0.5">
                    {events.map((e, idx) => {
                      const Icon = ICON_MAP[e.type];
                      return (
                        <div
                          key={`${e.type}-${idx}`}
                          className={cn('w-4 h-4 rounded flex items-center justify-center', COLOR_MAP[e.type])}
                        >
                          <Icon className="w-2.5 h-2.5" />
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[8px] text-gray-400 whitespace-nowrap">
                    {date.slice(5)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

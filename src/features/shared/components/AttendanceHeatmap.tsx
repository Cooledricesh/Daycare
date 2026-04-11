'use client';

import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  subMonths,
} from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMultiMonthAttendanceCalendar } from '../hooks/useMultiMonthAttendanceCalendar';

interface Props {
  patientId: string;
  className?: string;
}

function buildMonths(count: number): { year: number; month: number }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = subMonths(now, count - 1 - i);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export function AttendanceHeatmap({ patientId, className }: Props) {
  const [range, setRange] = useState<3 | 12>(3);
  const months = useMemo(() => buildMonths(range), [range]);
  const { isLoading, months: data } = useMultiMonthAttendanceCalendar(patientId, months);

  const attendedSet = new Set<string>();
  const scheduledSet = new Set<string>();
  const consultedSet = new Set<string>();

  for (const m of data) {
    m.data.attended_dates.forEach((d) => attendedSet.add(d));
    m.data.scheduled_dates.forEach((d) => scheduledSet.add(d));
    m.data.consulted_dates.forEach((d) => consultedSet.add(d));
  }

  const startDate = startOfWeek(startOfMonth(subMonths(new Date(), range - 1)), {
    weekStartsOn: 0,
  });
  const endDate = endOfWeek(endOfMonth(new Date()), { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  const getCellClass = (day: Date): string => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const attended = attendedSet.has(dateStr);
    const consulted = consultedSet.has(dateStr);
    const scheduledAbsent = scheduledSet.has(dateStr) && !attended;

    if (attended && consulted) return 'bg-emerald-500';
    if (attended) return 'bg-emerald-200';
    if (scheduledAbsent) return 'bg-red-300';
    return 'bg-gray-100';
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            출석 히트맵
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={range === 3 ? 'default' : 'outline'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setRange(3)}
            >
              3개월
            </Button>
            <Button
              variant={range === 12 ? 'default' : 'outline'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setRange(12)}
            >
              12개월
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {isLoading ? (
          <p className="text-xs text-gray-400 text-center py-4">로딩 중...</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-0.5" style={{ minWidth: weeks.length * 14 }}>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day) => (
                    <div
                      key={format(day, 'yyyy-MM-dd')}
                      className={cn('w-3 h-3 rounded-sm', getCellClass(day))}
                      title={`${format(day, 'yyyy-MM-dd')}`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-2 text-[10px] text-gray-500 justify-center">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                출석+진찰
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" />
                출석만
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" />
                예정미출석
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-100 inline-block" />
                비예정
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

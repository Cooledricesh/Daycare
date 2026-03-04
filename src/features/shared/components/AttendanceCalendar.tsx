'use client';

import { useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePatientAttendanceCalendar } from '../hooks/usePatientAttendanceCalendar';

interface AttendanceCalendarProps {
  patientId: string;
  className?: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function AttendanceCalendar({ patientId, className }: AttendanceCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const { data, isLoading } = usePatientAttendanceCalendar({
    patientId,
    year,
    month,
  });

  const attendedSet = new Set(data?.attended_dates || []);
  const scheduledSet = new Set(data?.scheduled_dates || []);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const prevMonth = () => setViewDate(new Date(year, month - 2, 1));
  const nextMonth = () => setViewDate(new Date(year, month, 1));

  return (
    <Card className={className}>
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5" />
            출석 현황
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={prevMonth}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs text-gray-600 min-w-[80px] text-center">
              {year}년 {month}월
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={nextMonth}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {isLoading ? (
          <p className="text-xs text-gray-400 text-center py-4">로딩 중...</p>
        ) : (
          <>
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((day, i) => (
                <div
                  key={day}
                  className={cn(
                    'text-center text-[10px] font-medium py-1',
                    i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const inMonth = isSameMonth(day, viewDate);
                const today = isToday(day);
                const attended = attendedSet.has(dateStr);
                const scheduledAbsent = scheduledSet.has(dateStr) && !attendedSet.has(dateStr);

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      'aspect-square flex items-center justify-center text-[11px] rounded-md',
                      !inMonth && 'text-gray-200',
                      inMonth && !attended && !scheduledAbsent && 'text-gray-700',
                      today && 'font-bold ring-1 ring-gray-300',
                      attended && 'bg-green-100 text-green-700 font-medium',
                      scheduledAbsent && 'bg-red-100 text-red-700 font-medium',
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                );
              })}
            </div>

            {/* 범례 */}
            <div className="flex gap-3 mt-2 text-[10px] text-gray-500 justify-center">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-300 inline-block" />
                출석
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 inline-block" />
                예정미출석
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

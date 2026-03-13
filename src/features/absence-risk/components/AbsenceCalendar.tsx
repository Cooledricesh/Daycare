'use client';

import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO,
  subMonths,
  addMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AbsenceDailyRecord } from '../backend/schema';

interface AbsenceCalendarProps {
  dailyRecords: AbsenceDailyRecord[];
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export function AbsenceCalendar({ dailyRecords }: AbsenceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const recordMap = new Map<string, AbsenceDailyRecord>();
  for (const record of dailyRecords) {
    recordMap.set(record.date, record);
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  function getCellStyle(dateStr: string): string {
    const record = recordMap.get(dateStr);
    if (!record) return 'bg-gray-50 text-gray-300';

    if (record.is_holiday || record.is_weekend) return 'bg-gray-100 text-gray-400';
    if (!record.scheduled) return 'bg-white text-gray-300';
    if (record.attended) return 'bg-green-100 text-green-700 font-medium';
    return 'bg-red-100 text-red-600 font-medium';
  }

  function getCellTitle(dateStr: string): string {
    const record = recordMap.get(dateStr);
    if (!record) return '';
    if (record.holiday_reason) return record.holiday_reason;
    if (record.is_weekend) return '주말';
    if (!record.scheduled) return '미예정';
    if (record.attended) return '출석';
    return '결석';
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="bg-white rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {format(currentMonth, 'yyyy년 M월')}
        </span>
        <button
          onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map(label => (
          <div key={label} className="text-center text-[10px] text-gray-400 py-1">
            {label}
          </div>
        ))}

        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              title={getCellTitle(dateStr)}
              className={cn(
                'aspect-square flex items-center justify-center text-[11px] rounded cursor-default',
                getCellStyle(dateStr),
                isToday && 'ring-1 ring-blue-400',
              )}
            >
              {format(day, 'd')}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-1">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 inline-block" />
          출석
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 inline-block" />
          결석
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-white border inline-block" />
          미예정
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-100 inline-block" />
          주말/공휴일
        </span>
      </div>
    </div>
  );
}

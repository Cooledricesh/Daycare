'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { STATS_DATA_START_DATE_OBJ } from '@/features/shared/constants/stats';

interface StatsDateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
}

const PRESETS = [
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
  { label: '최근 90일', days: 90 },
] as const;

export function StatsDateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: StatsDateRangePickerProps) {
  const handlePreset = (days: number) => {
    const newStart = subDays(new Date(), days);
    const clampedStart = newStart < STATS_DATA_START_DATE_OBJ ? STATS_DATA_START_DATE_OBJ : newStart;
    onStartDateChange(clampedStart);
    onEndDateChange(new Date());
  };

  const handleAllData = () => {
    onStartDateChange(STATS_DATA_START_DATE_OBJ);
    onEndDateChange(new Date());
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px] justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(startDate, 'yyyy-MM-dd')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => date && onStartDateChange(date)}
              fromDate={STATS_DATA_START_DATE_OBJ}
              toDate={endDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <span className="text-gray-500">~</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px] justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(endDate, 'yyyy-MM-dd')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => date && onEndDateChange(date)}
              fromDate={startDate}
              toDate={new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center gap-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset.days}
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => handlePreset(preset.days)}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={handleAllData}
        >
          전체
        </Button>
      </div>
    </div>
  );
}

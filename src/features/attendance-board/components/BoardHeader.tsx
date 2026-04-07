'use client';

import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { PIXEL_THEME } from '../constants/pixel-palette';
import { BOARD_CONFIG } from '../constants/board-config';

interface BoardHeaderProps {
  date: string;
  totalAttended: number;
  totalCount: number;
  isLoading: boolean;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
}

export function BoardHeader({
  date,
  totalAttended,
  totalCount,
  isLoading,
  onDateChange,
  onRefresh,
}: BoardHeaderProps) {
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = format(dateObj, 'yyyy년 M월 d일 (EEE)', { locale: ko });
  const attendanceRate = totalCount > 0
    ? Math.round((totalAttended / totalCount) * 100)
    : 0;

  const handlePrevDay = () => {
    const prev = subDays(dateObj, 1);
    onDateChange(format(prev, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const next = addDays(dateObj, 1);
    onDateChange(format(next, 'yyyy-MM-dd'));
  };

  const handleToday = () => {
    onDateChange(format(new Date(), 'yyyy-MM-dd'));
  };

  return (
    <div
      className="flex flex-col gap-3 p-4"
      style={{
        backgroundColor: PIXEL_THEME.CARD_BG,
        border: `2px solid ${PIXEL_THEME.BORDER}`,
        boxShadow: `4px 4px 0px ${PIXEL_THEME.BORDER}`,
        borderRadius: 0,
        fontFamily: BOARD_CONFIG.PIXEL_FONT,
      }}
    >
      {/* 상단: 날짜 네비게이션 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-none"
            style={{ border: `1px solid ${PIXEL_THEME.BORDER}` }}
            onClick={handlePrevDay}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm font-bold" style={{ color: PIXEL_THEME.TEXT }}>
            {formattedDate}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-none"
            style={{ border: `1px solid ${PIXEL_THEME.BORDER}` }}
            onClick={handleNextDay}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-none text-[10px] px-2"
            style={{
              border: `1px solid ${PIXEL_THEME.BORDER}`,
              color: PIXEL_THEME.TEXT,
            }}
            onClick={handleToday}
          >
            오늘
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-none"
          style={{ border: `1px solid ${PIXEL_THEME.BORDER}` }}
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 하단: 전체 출석률 */}
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: PIXEL_THEME.TEXT }}>
          전체 출석
        </span>
        <div className="flex-1 relative">
          <div
            className="w-full h-4"
            style={{
              backgroundColor: PIXEL_THEME.EMPTY_SEAT,
              border: `2px solid ${PIXEL_THEME.BORDER}`,
              borderRadius: 0,
            }}
          >
            <div
              className="h-full transition-all duration-700 ease-out"
              style={{
                width: `${attendanceRate}%`,
                backgroundColor: PIXEL_THEME.ATTENDED,
                imageRendering: 'pixelated',
              }}
            />
          </div>
        </div>
        <span
          className="text-xs font-bold min-w-[80px] text-right"
          style={{ color: PIXEL_THEME.TEXT }}
        >
          {totalAttended}/{totalCount} ({attendanceRate}%)
        </span>
      </div>
    </div>
  );
}

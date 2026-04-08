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
  totalScheduled: number;
  totalConsulted: number;
  totalUnscheduledAttended: number;
  totalCount: number;
  isLoading: boolean;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
}

export function BoardHeader({
  date,
  totalAttended,
  totalScheduled,
  totalConsulted,
  totalUnscheduledAttended,
  totalCount,
  isLoading,
  onDateChange,
  onRefresh,
}: BoardHeaderProps) {
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = format(dateObj, 'yyyy년 M월 d일 (EEE)', { locale: ko });

  const scheduledAttended = totalAttended - totalUnscheduledAttended;
  const attendanceRate = totalScheduled > 0 ? Math.round((scheduledAttended / totalScheduled) * 100) : 0;
  const consultationRate = totalAttended > 0 ? Math.round((totalConsulted / totalAttended) * 100) : 0;

  const consultedBarPct = totalScheduled > 0 ? Math.round((totalConsulted / totalScheduled) * 100) : 0;
  const waitingBarPct = totalScheduled > 0 ? Math.round(((totalAttended - totalConsulted) / totalScheduled) * 100) : 0;

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
      {/* 날짜 네비게이션 */}
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
            style={{ border: `1px solid ${PIXEL_THEME.BORDER}`, color: PIXEL_THEME.TEXT }}
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

      {/* 출석율 + 진찰율 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: PIXEL_THEME.TEXT }}>
            출석 <b>{scheduledAttended}/{totalScheduled}</b> ({attendanceRate}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: PIXEL_THEME.TEXT }}>
            진찰 <b>{totalConsulted}/{totalAttended}</b> ({consultationRate}%)
          </span>
        </div>
        {totalUnscheduledAttended > 0 && (
          <span className="text-[10px] font-bold" style={{ color: '#ef5350' }}>
            ⚠ 비예정 +{totalUnscheduledAttended}명
          </span>
        )}
      </div>

      {/* 3-segment 진행 바 */}
      <div
        className="w-full h-4 flex"
        style={{
          backgroundColor: PIXEL_THEME.EMPTY_SEAT,
          border: `2px solid ${PIXEL_THEME.BORDER}`,
          borderRadius: 0,
        }}
      >
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(consultedBarPct, 100)}%`, backgroundColor: PIXEL_THEME.ATTENDED }}
        />
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(Math.max(waitingBarPct, 0), 100)}%`, backgroundColor: '#efb96b' }}
        />
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 flex-wrap">
        <LegendItem color="#4ade80" label="진찰 완료" />
        <LegendItem color="#efb96b" label="진찰 대기" />
        <LegendItem color="#d4d0c8" label="미출석" />
        <LegendItem color="#c0b8a8" label="예정 없음" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block w-2.5 h-2.5"
        style={{ backgroundColor: color, border: '1px solid rgba(0,0,0,0.15)' }}
      />
      <span className="text-[10px]" style={{ color: '#5c4a3a' }}>{label}</span>
    </div>
  );
}

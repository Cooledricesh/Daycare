'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useAttendanceBoardData } from '../hooks/useAttendanceBoardData';
import { BoardHeader } from './BoardHeader';
import { SchoolFloor } from './SchoolFloor';
import { PIXEL_THEME } from '../constants/pixel-palette';
import { BOARD_CONFIG } from '../constants/board-config';

export function AttendanceBoardPage() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const { data, isLoading, refetch } = useAttendanceBoardData(date);

  return (
    <div
      className="min-h-full p-4 md:p-6 lg:p-8 space-y-4"
      style={{
        backgroundColor: PIXEL_THEME.BG,
        fontFamily: BOARD_CONFIG.PIXEL_FONT,
      }}
    >
      {/* 타이틀 */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🏫</span>
        <h1
          className="text-lg md:text-xl font-bold tracking-wider"
          style={{
            color: PIXEL_THEME.TEXT,
            textShadow: `2px 2px 0px ${PIXEL_THEME.EMPTY_SEAT}`,
          }}
        >
          출석 보드
        </h1>
      </div>

      {/* 헤더 */}
      <BoardHeader
        date={date}
        totalAttended={data?.total_attended ?? 0}
        totalScheduled={data?.total_scheduled ?? 0}
        totalConsulted={data?.total_consulted ?? 0}
        totalUnscheduledAttended={data?.total_unscheduled_attended ?? 0}
        totalCount={data?.total_count ?? 0}
        isLoading={isLoading}
        onDateChange={setDate}
        onRefresh={() => refetch()}
      />

      {/* 로딩 상태 */}
      {isLoading && !data && (
        <div
          className="flex flex-col items-center justify-center py-16 gap-3"
          style={{ color: PIXEL_THEME.TEXT }}
        >
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading...</p>
        </div>
      )}

      {/* 학교 건물 레이아웃 */}
      {data && data.rooms.length > 0 && (
        <SchoolFloor rooms={data.rooms} />
      )}

      {/* 빈 상태 */}
      {data && data.rooms.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16"
          style={{
            color: '#9e9a8e',
            fontFamily: BOARD_CONFIG.PIXEL_FONT,
          }}
        >
          <p className="text-sm">오늘 예정된 환자가 없습니다</p>
        </div>
      )}
    </div>
  );
}

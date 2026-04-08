'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { PIXEL_THEME } from '../constants/pixel-palette';
import { BOARD_CONFIG } from '../constants/board-config';
import { PixelAvatar } from './PixelAvatar';
import { StreakEffect } from './StreakEffect';
import { SeatPopover } from './SeatPopover';
import type { AttendanceStatus, BoardPatient } from '../backend/schema';

interface SeatCellProps {
  patient: BoardPatient;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  attended_consulted: '출석+진찰',
  attended: '출석 (진찰 대기)',
  absent: '미출석',
  not_scheduled: '예정 없음',
};

const NAME_COLORS: Record<AttendanceStatus, string> = {
  attended_consulted: PIXEL_THEME.TEXT,
  attended: PIXEL_THEME.TEXT,
  absent: '#a09888',
  not_scheduled: '#c0b8a8',
};

function getDelay(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 3000) / 1000;
}

function getDuration(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 3) - h + id.charCodeAt(i)) | 0;
  return 2.5 + (Math.abs(h) % 2000) / 1000;
}

function getAnimation(status: AttendanceStatus, duration: number, delay: number): string | undefined {
  switch (status) {
    case 'attended_consulted':
    case 'attended':
      return `pixelHop ${duration}s ease-in-out ${delay}s infinite`;
    case 'absent':
      return `ghostFloat ${duration + 1}s ease-in-out ${delay}s infinite`;
    case 'not_scheduled':
      return undefined;
  }
}

export function SeatCell({ patient }: SeatCellProps) {
  const delay = useMemo(() => getDelay(patient.id), [patient.id]);
  const duration = useMemo(() => getDuration(patient.id), [patient.id]);
  const animation = useMemo(() => getAnimation(patient.status, duration, delay), [patient.status, duration, delay]);

  return (
    <SeatPopover patient={patient}>
      <button
        type="button"
        className={cn(
          'relative flex flex-col items-center gap-0 p-0.5 cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'hover:scale-110 hover:z-10 transition-transform',
        )}
        style={{ fontFamily: BOARD_CONFIG.PIXEL_FONT }}
        aria-label={`${patient.name} - ${STATUS_LABELS[patient.status]}${patient.attendance_streak >= 3 ? ` (${patient.attendance_streak}일 연속)` : ''}`}
      >
        <div style={{ animation }}>
          <StreakEffect
            tier={patient.streak_tier}
            streak={patient.attendance_streak}
            consultationStreak={patient.consultation_streak}
          >
            <PixelAvatar
              patientId={patient.id}
              name={patient.name}
              gender={patient.gender}
              status={patient.status}
              hasTask={patient.has_task && !patient.task_completed}
            />
          </StreakEffect>
        </div>

        {/* 이름 */}
        <span
          className="text-[8px] truncate max-w-[56px] leading-tight"
          style={{
            color: NAME_COLORS[patient.status],
            textShadow: '0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          {patient.name}
        </span>
      </button>
    </SeatPopover>
  );
}

'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PIXEL_THEME } from '../constants/pixel-palette';
import { BOARD_CONFIG } from '../constants/board-config';
import type { AttendanceStatus, BoardPatient, StreakTier } from '../backend/schema';

interface SeatPopoverProps {
  patient: BoardPatient;
  children: React.ReactNode;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

const TIER_LABELS: Record<StreakTier, string> = {
  none: '',
  fire: '🔥 시작!',
  lightning: '⚡ 달리는 중!',
  diamond: '💎 다이아몬드!',
  crown: '👑 전설!',
  myth: '🌟 신화!',
};

const STATUS_DISPLAY: Record<AttendanceStatus, { icon: string; label: string }> = {
  attended_consulted: { icon: '✅', label: '출석 + 진찰 완료' },
  attended: { icon: '🟡', label: '출석 (진찰 대기)' },
  absent: { icon: '❌', label: '미출석 (예정됨)' },
  not_scheduled: { icon: '⬜', label: '오늘 예정 없음' },
};

export function SeatPopover({ patient, children }: SeatPopoverProps) {
  const statusInfo = STATUS_DISPLAY[patient.status];

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-3"
        style={{
          backgroundColor: PIXEL_THEME.CARD_BG,
          border: `2px solid ${PIXEL_THEME.BORDER}`,
          borderRadius: 0,
          boxShadow: `3px 3px 0px ${PIXEL_THEME.BORDER}`,
          fontFamily: BOARD_CONFIG.PIXEL_FONT,
        }}
      >
        <div className="space-y-2">
          <p className="font-bold text-sm" style={{ color: PIXEL_THEME.TEXT }}>
            {patient.name}
          </p>

          <div className="text-xs space-y-1" style={{ color: PIXEL_THEME.TEXT }}>
            <p>
              {statusInfo.icon} {statusInfo.label}
              {patient.attendance_time && ` ${formatTime(patient.attendance_time)}`}
            </p>

            {patient.has_task && (
              <p>
                <span className="inline-block w-2 h-2 mr-1" style={{ backgroundColor: PIXEL_THEME.TASK }} />
                과제 {patient.task_completed ? '완료' : '진행중'}
              </p>
            )}
          </div>

          {/* 스트릭 정보 */}
          {patient.attendance_streak >= 1 && (
            <div
              className="pt-1.5 mt-1.5 text-xs space-y-0.5"
              style={{ borderTop: `1px dashed ${PIXEL_THEME.BORDER}`, color: PIXEL_THEME.TEXT }}
            >
              <p>
                연속 출석: <strong>{patient.attendance_streak}일</strong>
                {patient.streak_tier !== 'none' && (
                  <span className="ml-1">{TIER_LABELS[patient.streak_tier]}</span>
                )}
              </p>
              {patient.consultation_streak >= 1 && (
                <p>
                  연속 진찰: <strong>{patient.consultation_streak}일</strong>
                  {patient.consultation_streak >= 3 && <span className="ml-1">♥</span>}
                </p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

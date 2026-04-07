'use client';

import { BOARD_CONFIG } from '../constants/board-config';
import { SeatCell } from './SeatCell';
import type { RoomGroup } from '../backend/schema';

interface RoomCardProps {
  room: RoomGroup;
}

/** 호실별 바닥 타일 색상 (미세한 변화) */
const FLOOR_COLORS = [
  { tile: '#e8dfd0', gap: '#d8cfbf' },
  { tile: '#dfe8d8', gap: '#cfd8c8' },
  { tile: '#d8dfe8', gap: '#c8cfd8' },
  { tile: '#e8e0d8', gap: '#d8d0c8' },
  { tile: '#e0e8d8', gap: '#d0d8c8' },
  { tile: '#e8dde0', gap: '#d8cdd0' },
];

export function RoomCard({ room }: RoomCardProps) {
  const roomIndex = parseInt(room.room_prefix.slice(-2), 10) || 0;
  const floor = FLOOR_COLORS[roomIndex % FLOOR_COLORS.length];
  const attendanceRate = room.total_count > 0
    ? Math.round((room.attended_count / room.total_count) * 100)
    : 0;

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        border: '3px solid #6b5c4a',
        boxShadow: 'inset 0 0 0 1px #9e8e78',
      }}
    >
      {/* 칠판 (교실 상단 벽) */}
      <div
        className="relative px-3 py-2"
        style={{
          background: 'linear-gradient(180deg, #7a6a58 0%, #6b5c4a 4px, #2d5a3a 4px, #3d6b4a 100%)',
          fontFamily: BOARD_CONFIG.PIXEL_FONT,
        }}
      >
        {/* 칠판 내용 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-bold"
              style={{
                color: '#c8e6c0',
                textShadow: '1px 1px 0px rgba(0,0,0,0.3)',
              }}
            >
              {room.room_prefix}호
            </span>
            {room.coordinator_name && (
              <span
                className="text-[10px]"
                style={{ color: '#a0d498' }}
              >
                {room.coordinator_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold"
              style={{ color: '#c8e6c0' }}
            >
              {room.attended_count}/{room.total_count}
            </span>
            {/* 출석률 바 */}
            <div
              className="w-14 h-2 overflow-hidden"
              style={{
                backgroundColor: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${attendanceRate}%`,
                  backgroundColor: attendanceRate >= 80 ? '#6bef70' : attendanceRate >= 50 ? '#efef6b' : '#ef6b6b',
                }}
              />
            </div>
          </div>
        </div>

        {/* 칠판 테두리 (하단 분필 받침) */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 3, backgroundColor: '#8a7b68' }}
        />
      </div>

      {/* 교실 바닥 + 책상 배치 (탑뷰) */}
      <div
        className="p-3"
        style={{
          background: `
            repeating-linear-gradient(
              90deg,
              ${floor.tile} 0px,
              ${floor.tile} 31px,
              ${floor.gap} 31px,
              ${floor.gap} 32px
            ),
            repeating-linear-gradient(
              0deg,
              ${floor.tile} 0px,
              ${floor.tile} 31px,
              ${floor.gap} 31px,
              ${floor.gap} 32px
            )
          `,
          backgroundSize: '32px 32px',
          minHeight: 80,
        }}
      >
        {room.patients.length === 0 ? (
          <p
            className="text-center text-xs py-8"
            style={{
              color: '#a09888',
              fontFamily: BOARD_CONFIG.PIXEL_FONT,
            }}
          >
            빈 교실
          </p>
        ) : (
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${BOARD_CONFIG.SEAT_COLUMNS}, 1fr)`,
            }}
          >
            {room.patients.map((patient) => (
              <SeatCell key={patient.id} patient={patient} />
            ))}
          </div>
        )}
      </div>

      {/* 교실 하단 벽 */}
      <div style={{ height: 6, backgroundColor: '#7a6a58' }} />
    </div>
  );
}

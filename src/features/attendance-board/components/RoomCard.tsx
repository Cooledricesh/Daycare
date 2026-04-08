'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { BOARD_CONFIG } from '../constants/board-config';
import { SeatCell } from './SeatCell';
import type { AttendanceStatus, BoardPatient, RoomGroup } from '../backend/schema';

interface RoomCardProps {
  room: RoomGroup;
}

/** 레인 스타일 설정 */
const LANE_CONFIG: Record<Exclude<AttendanceStatus, 'not_scheduled'>, {
  icon: string;
  label: string;
  bg: string;
  headerBorder: string;
  textColor: string;
  pillBg: string;
}> = {
  attended_consulted: {
    icon: '✅', label: '진찰 완료',
    bg: '#e8f5e9', headerBorder: '#a5d6a7',
    textColor: '#2e7d32', pillBg: '#c8e6c9',
  },
  attended: {
    icon: '⏳', label: '진찰 대기',
    bg: '#fff8e1', headerBorder: '#ffe082',
    textColor: '#e65100', pillBg: '#fff0c0',
  },
  absent: {
    icon: '💤', label: '미출석',
    bg: '#f5f5f5', headerBorder: '#e0e0e0',
    textColor: '#757575', pillBg: '#eeeeee',
  },
};

export function RoomCard({ room }: RoomCardProps) {
  const consulted = room.patients.filter((p) => p.status === 'attended_consulted');
  const waiting = room.patients.filter((p) => p.status === 'attended');
  const absent = room.patients.filter((p) => p.status === 'absent');
  const notScheduled = room.patients.filter((p) => p.status === 'not_scheduled');

  const scheduled = room.scheduled_count;
  const scheduledAttended = room.attended_count - room.unscheduled_attended_count;
  const attendanceRate = scheduled > 0 ? Math.round((scheduledAttended / scheduled) * 100) : 0;
  const consultationRate = room.attended_count > 0 ? Math.round((room.consulted_count / room.attended_count) * 100) : 0;

  // 3-segment 바 비율 (예정 기준)
  const consultedBarPct = scheduled > 0 ? Math.round((room.consulted_count / scheduled) * 100) : 0;
  const waitingBarPct = scheduled > 0 ? Math.round(((room.attended_count - room.consulted_count) / scheduled) * 100) : 0;

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        border: '3px solid #6b5c4a',
        boxShadow: 'inset 0 0 0 1px #9e8e78',
      }}
    >
      {/* 칠판 */}
      <div
        className="relative px-3 py-2"
        style={{
          background: 'linear-gradient(180deg, #7a6a58 0%, #6b5c4a 4px, #2d5a3a 4px, #3d6b4a 100%)',
          fontFamily: BOARD_CONFIG.PIXEL_FONT,
        }}
      >
        {/* 1행: 호실 + 코디 | 출석율 · 진찰율 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-bold"
              style={{ color: '#c8e6c0', textShadow: '1px 1px 0px rgba(0,0,0,0.3)' }}
            >
              {room.room_prefix}호
            </span>
            {room.coordinator_name && (
              <span className="text-[10px]" style={{ color: '#a0d498' }}>
                {room.coordinator_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: '#a0d498' }}>
              출석 <b style={{ color: '#c8e6c0' }}>{scheduledAttended}/{scheduled}</b>
              <span style={{ color: '#7ab872' }}>({attendanceRate}%)</span>
            </span>
            <span className="text-[10px]" style={{ color: '#a0d498' }}>
              진찰 <b style={{ color: '#c8e6c0' }}>{room.consulted_count}/{room.attended_count}</b>
              <span style={{ color: '#7ab872' }}>({consultationRate}%)</span>
            </span>
          </div>
        </div>

        {/* 2행: 3-segment 바 + 비예정 경고 */}
        <div className="flex items-center gap-2 mt-1">
          <div
            className="flex-1 flex h-[5px] overflow-hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${Math.min(consultedBarPct, 100)}%`, backgroundColor: '#6bef70' }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${Math.min(Math.max(waitingBarPct, 0), 100)}%`, backgroundColor: '#efb96b' }}
            />
          </div>
          {room.unscheduled_attended_count > 0 && (
            <span className="text-[9px] font-bold" style={{ color: '#ff8a80' }}>
              ⚠ 비예정 +{room.unscheduled_attended_count}
            </span>
          )}
        </div>

        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 3, backgroundColor: '#8a7b68' }}
        />
      </div>

      {/* 레인들 */}
      {room.patients.length === 0 ? (
        <div
          className="p-6 text-center text-xs"
          style={{ color: '#a09888', fontFamily: BOARD_CONFIG.PIXEL_FONT, background: '#f5f5f5' }}
        >
          빈 교실
        </div>
      ) : (
        <>
          <StatusLane status="attended_consulted" patients={consulted} />
          <StatusLane status="attended" patients={waiting} />
          <StatusLane status="absent" patients={absent} />
          {notScheduled.length > 0 && (
            <CollapsibleSection patients={notScheduled} />
          )}
        </>
      )}

      {/* 교실 하단 벽 */}
      <div style={{ height: 6, backgroundColor: '#7a6a58' }} />
    </div>
  );
}

/** 상태별 레인 */
function StatusLane({
  status,
  patients,
}: {
  status: Exclude<AttendanceStatus, 'not_scheduled'>;
  patients: BoardPatient[];
}) {
  if (patients.length === 0) return null;

  const config = LANE_CONFIG[status];

  return (
    <div style={{ background: config.bg, borderBottom: `2px solid ${config.headerBorder}` }}>
      {/* 레인 헤더 */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1"
        style={{ borderBottom: `1px solid ${config.headerBorder}40` }}
      >
        <span style={{ fontSize: 10 }}>{config.icon}</span>
        <span
          className="text-[10px] font-bold"
          style={{ color: config.textColor, fontFamily: BOARD_CONFIG.PIXEL_FONT }}
        >
          {config.label}
        </span>
        <span
          className="text-[9px] px-1.5 py-0 rounded-full"
          style={{ color: config.textColor, backgroundColor: config.pillBg }}
        >
          {patients.length}명
        </span>
      </div>

      {/* 환자 그리드 */}
      <div className="flex flex-wrap gap-0.5 px-2 py-1.5">
        {patients.map((patient) => (
          <SeatCell key={patient.id} patient={patient} />
        ))}
      </div>
    </div>
  );
}

/** 접힌 섹션: 예정 없음 */
function CollapsibleSection({ patients }: { patients: BoardPatient[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ background: '#ede7d8' }}>
      <button
        type="button"
        className="flex items-center gap-1.5 px-2.5 py-1.5 w-full text-left cursor-pointer hover:bg-[#e4ddd0] transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ fontFamily: BOARD_CONFIG.PIXEL_FONT }}
      >
        {isOpen
          ? <ChevronDown className="w-3 h-3" style={{ color: '#8a7a6a' }} />
          : <ChevronRight className="w-3 h-3" style={{ color: '#8a7a6a' }} />
        }
        <span className="text-[10px]" style={{ color: '#8a7a6a' }}>예정 없음</span>
        <span
          className="text-[9px] px-1.5 py-0 rounded-full"
          style={{ color: '#a89a8a', backgroundColor: '#ddd8c8' }}
        >
          {patients.length}명
        </span>
      </button>
      {isOpen && (
        <div className="flex flex-wrap gap-0.5 px-2 py-1.5" style={{ opacity: 0.5 }}>
          {patients.map((patient) => (
            <SeatCell key={patient.id} patient={patient} />
          ))}
        </div>
      )}
    </div>
  );
}

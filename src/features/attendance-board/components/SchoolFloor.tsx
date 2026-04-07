'use client';

import { RoomCard } from './RoomCard';
import { Hallway } from './Hallway';
import { BOARD_CONFIG } from '../constants/board-config';
import type { RoomGroup } from '../backend/schema';

interface SchoolFloorProps {
  rooms: RoomGroup[];
}

/**
 * 탑뷰 학교 평면도
 * - 2열 교실 배치 + 복도
 * - RPG 게임 스타일 탑다운 뷰
 */
export function SchoolFloor({ rooms }: SchoolFloorProps) {
  const pairs: Array<{ left: RoomGroup; right?: RoomGroup }> = [];
  for (let i = 0; i < rooms.length; i += 2) {
    pairs.push({ left: rooms[i], right: rooms[i + 1] });
  }

  return (
    <div
      style={{
        fontFamily: BOARD_CONFIG.PIXEL_FONT,
        border: '4px solid #6b5c4a',
        backgroundColor: '#c4b08a',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {pairs.map((pair, index) => (
        <div key={pair.left.room_prefix}>
          {/* 복도 (쌍 사이) */}
          {index > 0 && <Hallway />}

          {/* 교실 쌍 */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-1.5">
              <RoomCard room={pair.left} />
            </div>

            {pair.right ? (
              <div className="p-1.5">
                <RoomCard room={pair.right} />
              </div>
            ) : (
              <div
                className="p-1.5 flex items-center justify-center m-1.5"
                style={{
                  border: '2px dashed #a89878',
                  backgroundColor: 'rgba(168,152,120,0.15)',
                }}
              >
                <span className="text-[10px]" style={{ color: '#a89878' }}>
                  빈 교실
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

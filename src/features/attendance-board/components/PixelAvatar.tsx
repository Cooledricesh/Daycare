'use client';

import { getAvatarColor } from '../lib/avatar-color';
import type { AttendanceStatus } from '../backend/schema';

interface PixelAvatarProps {
  patientId: string;
  name: string;
  gender: 'M' | 'F' | null;
  status: AttendanceStatus;
  hasTask?: boolean;
}

export function PixelAvatar({ patientId, name, gender, status, hasTask }: PixelAvatarProps) {
  const color = getAvatarColor(patientId);
  const initial = name.charAt(0);
  const isMale = gender !== 'F';

  switch (status) {
    case 'attended_consulted':
      return (
        <div className="relative w-10 h-12 flex items-center justify-center">
          {isMale
            ? <MaleSeated color={color} initial={initial} />
            : <FemaleSeated color={color} initial={initial} />
          }
          <TaskBadge hasTask={hasTask} />
        </div>
      );
    case 'attended':
      return (
        <div className="relative w-10 h-12 flex items-center justify-center">
          {isMale
            ? <MaleStanding color={color} initial={initial} />
            : <FemaleStanding color={color} initial={initial} />
          }
          <TaskBadge hasTask={hasTask} />
        </div>
      );
    case 'absent':
      return <EmptySeat initial={initial} />;
    case 'not_scheduled':
      return <CoveredDesk initial={initial} />;
  }
}

/** 과제 뱃지 */
function TaskBadge({ hasTask }: { hasTask?: boolean }) {
  if (!hasTask) return null;
  return (
    <span
      className="absolute -top-0.5 -left-0.5 flex items-center justify-center w-4 h-4 text-[8px]"
      style={{
        backgroundColor: '#f97316',
        border: '1.5px solid #9a3412',
        color: 'white',
        fontWeight: 'bold',
      }}
    >
      !
    </span>
  );
}

/** 남자 캐릭터 - 착석 (출석+진찰) */
function MaleSeated({ color, initial }: { color: string; initial: string }) {
  return (
    <svg width="40" height="48" viewBox="0 0 40 48" style={{ imageRendering: 'pixelated' }}>
      {/* 책상 */}
      <rect x="3" y="34" width="34" height="11" fill="#b08a5c" stroke="#7a5c34" strokeWidth="1.2" />
      <rect x="5" y="36" width="30" height="7" fill="#c4a06c" />
      <rect x="24" y="37" width="8" height="4" fill="#e8e0d0" stroke="#a09080" strokeWidth="0.5" />

      {/* 몸통 - 파란 셔츠 */}
      <rect x="9" y="22" width="22" height="14" rx="3" fill="#4a90d9" stroke="#2c5a8a" strokeWidth="1.2" />
      <polygon points="16,22 20,26 24,22" fill="#5aa0e9" stroke="#2c5a8a" strokeWidth="0.5" />
      <rect x="14" y="27" width="12" height="6" rx="1" fill="white" stroke="#2c5a8a" strokeWidth="0.7" />
      <text x="20" y="32" textAnchor="middle" fontSize="5.5" fill="#2c5a8a" fontFamily="monospace" fontWeight="bold">{initial}</text>

      {/* 머리 */}
      <circle cx="20" cy="14" r="10" fill="#fce4c0" stroke="#d4a06c" strokeWidth="1.2" />
      <path d="M10,14 L10,9 Q10,3 20,2 Q30,3 30,9 L30,14" fill="#3a2a1a" />
      <path d="M12,13 L12,10 Q12,5 20,4 Q28,5 28,10 L28,13" fill="#fce4c0" />
      <path d="M12,10 Q14,8 18,9 L12,10" fill="#3a2a1a" />

      {/* 눈 */}
      <ellipse cx="16" cy="14" rx="1.8" ry="2" fill="#2c2c2c" />
      <circle cx="16.5" cy="13.2" r="0.7" fill="white" />
      <ellipse cx="24" cy="14" rx="1.8" ry="2" fill="#2c2c2c" />
      <circle cx="24.5" cy="13.2" r="0.7" fill="white" />

      {/* 눈썹 */}
      <line x1="14" y1="11" x2="18" y2="11.5" stroke="#3a2a1a" strokeWidth="0.8" />
      <line x1="22" y1="11.5" x2="26" y2="11" stroke="#3a2a1a" strokeWidth="0.8" />

      {/* 볼 */}
      <ellipse cx="12" cy="16" rx="1.5" ry="1" fill="#ffb0a0" opacity="0.4" />
      <ellipse cx="28" cy="16" rx="1.5" ry="1" fill="#ffb0a0" opacity="0.4" />

      {/* 입 */}
      <path d="M17,18 Q20,20 23,18" fill="none" stroke="#c07050" strokeWidth="0.8" />
    </svg>
  );
}

/** 여자 캐릭터 - 착석 (출석+진찰) */
function FemaleSeated({ color, initial }: { color: string; initial: string }) {
  return (
    <svg width="40" height="48" viewBox="0 0 40 48" style={{ imageRendering: 'pixelated' }}>
      {/* 책상 */}
      <rect x="3" y="34" width="34" height="11" fill="#b08a5c" stroke="#7a5c34" strokeWidth="1.2" />
      <rect x="5" y="36" width="30" height="7" fill="#c4a06c" />
      <rect x="24" y="37" width="8" height="4" fill="#e8e0d0" stroke="#a09080" strokeWidth="0.5" />

      {/* 머리카락 */}
      <path d="M7,12 Q6,4 20,1 Q34,4 33,12 L33,28 Q33,30 30,30 L30,22 L10,22 L10,30 Q7,30 7,28 Z" fill="#5a3018" />

      {/* 몸통 - 분홍 블라우스 */}
      <rect x="9" y="22" width="22" height="14" rx="3" fill="#e88ca8" stroke="#c06080" strokeWidth="1.2" />
      <path d="M14,22 Q17,24 20,22 Q23,24 26,22" fill="none" stroke="white" strokeWidth="1" opacity="0.8" />
      <rect x="14" y="27" width="12" height="6" rx="1" fill="white" stroke="#c06080" strokeWidth="0.7" />
      <text x="20" y="32" textAnchor="middle" fontSize="5.5" fill="#c06080" fontFamily="monospace" fontWeight="bold">{initial}</text>

      {/* 머리 */}
      <circle cx="20" cy="14" r="10" fill="#fce4c0" stroke="#d4a06c" strokeWidth="1.2" />
      <path d="M10,14 L10,8 Q10,3 20,2 Q30,3 30,8 L30,14" fill="#5a3018" />
      <path d="M12,13 Q12,6 20,5 Q28,6 28,13" fill="#fce4c0" />
      <path d="M13,12 Q16,7 20,8 Q17,9 15,12" fill="#5a3018" />
      <path d="M27,12 Q24,7 20,8 Q23,9 25,12" fill="#5a3018" />
      <path d="M9,13 Q8,13 8,16 L8,22 Q8,23 9,23 L10,23 L10,14 Z" fill="#5a3018" />
      <path d="M31,13 Q32,13 32,16 L32,22 Q32,23 31,23 L30,23 L30,14 Z" fill="#5a3018" />

      {/* 리본 */}
      <circle cx="28" cy="5" r="2.5" fill="#ff6b9d" stroke="#d44a7a" strokeWidth="0.7" />
      <circle cx="28" cy="5" r="0.8" fill="#d44a7a" />

      {/* 눈 */}
      <ellipse cx="16" cy="13.5" rx="2" ry="2.3" fill="#2c2c2c" />
      <circle cx="16.8" cy="12.8" r="0.9" fill="white" />
      <circle cx="15.5" cy="14" r="0.4" fill="white" />
      <ellipse cx="24" cy="13.5" rx="2" ry="2.3" fill="#2c2c2c" />
      <circle cx="24.8" cy="12.8" r="0.9" fill="white" />
      <circle cx="23.5" cy="14" r="0.4" fill="white" />

      {/* 속눈썹 */}
      <line x1="13.5" y1="11.5" x2="14.5" y2="11" stroke="#2c2c2c" strokeWidth="0.5" />
      <line x1="25.5" y1="11" x2="26.5" y2="11.5" stroke="#2c2c2c" strokeWidth="0.5" />

      {/* 볼 */}
      <ellipse cx="12" cy="16" rx="2" ry="1.2" fill="#ffb0a0" opacity="0.5" />
      <ellipse cx="28" cy="16" rx="2" ry="1.2" fill="#ffb0a0" opacity="0.5" />

      {/* 입 */}
      <path d="M18,18 Q20,19.5 22,18" fill="none" stroke="#e07060" strokeWidth="0.7" />
    </svg>
  );
}

/** 남자 캐릭터 - 서있음 (출석만, 진찰 대기) */
function MaleStanding({ color, initial }: { color: string; initial: string }) {
  return (
    <svg width="40" height="48" viewBox="0 0 40 48" style={{ imageRendering: 'pixelated' }}>
      {/* 바닥 그림자 */}
      <ellipse cx="20" cy="46" rx="10" ry="2" fill="#00000015" />

      {/* 다리 */}
      <rect x="14" y="36" width="5" height="8" fill="#4a6a8a" stroke="#2c4a6a" strokeWidth="0.8" />
      <rect x="21" y="36" width="5" height="8" fill="#4a6a8a" stroke="#2c4a6a" strokeWidth="0.8" />
      {/* 신발 */}
      <rect x="13" y="43" width="7" height="3" rx="1" fill="#5c4a3a" stroke="#3a2a1a" strokeWidth="0.7" />
      <rect x="20" y="43" width="7" height="3" rx="1" fill="#5c4a3a" stroke="#3a2a1a" strokeWidth="0.7" />

      {/* 몸통 - 파란 셔츠 */}
      <rect x="9" y="22" width="22" height="16" rx="3" fill="#4a90d9" stroke="#2c5a8a" strokeWidth="1.2" />
      <polygon points="16,22 20,26 24,22" fill="#5aa0e9" stroke="#2c5a8a" strokeWidth="0.5" />
      <rect x="14" y="28" width="12" height="6" rx="1" fill="white" stroke="#2c5a8a" strokeWidth="0.7" />
      <text x="20" y="33" textAnchor="middle" fontSize="5.5" fill="#2c5a8a" fontFamily="monospace" fontWeight="bold">{initial}</text>

      {/* 머리 */}
      <circle cx="20" cy="14" r="10" fill="#fce4c0" stroke="#d4a06c" strokeWidth="1.2" />
      <path d="M10,14 L10,9 Q10,3 20,2 Q30,3 30,9 L30,14" fill="#3a2a1a" />
      <path d="M12,13 L12,10 Q12,5 20,4 Q28,5 28,10 L28,13" fill="#fce4c0" />
      <path d="M12,10 Q14,8 18,9 L12,10" fill="#3a2a1a" />

      {/* 눈 */}
      <ellipse cx="16" cy="14" rx="1.8" ry="2" fill="#2c2c2c" />
      <circle cx="16.5" cy="13.2" r="0.7" fill="white" />
      <ellipse cx="24" cy="14" rx="1.8" ry="2" fill="#2c2c2c" />
      <circle cx="24.5" cy="13.2" r="0.7" fill="white" />

      {/* 눈썹 */}
      <line x1="14" y1="11" x2="18" y2="11.5" stroke="#3a2a1a" strokeWidth="0.8" />
      <line x1="22" y1="11.5" x2="26" y2="11" stroke="#3a2a1a" strokeWidth="0.8" />

      {/* 볼 */}
      <ellipse cx="12" cy="16" rx="1.5" ry="1" fill="#ffb0a0" opacity="0.4" />
      <ellipse cx="28" cy="16" rx="1.5" ry="1" fill="#ffb0a0" opacity="0.4" />

      {/* 입 - 약간 걱정 */}
      <path d="M18,18 L22,18" fill="none" stroke="#c07050" strokeWidth="0.8" />

      {/* ? 말풍선 */}
      <rect x="29" y="2" width="10" height="9" rx="2" fill="white" stroke="#5c4a3a" strokeWidth="0.8" />
      <polygon points="31,11 33,14 35,11" fill="white" stroke="#5c4a3a" strokeWidth="0.8" />
      <polygon points="31.5,11 33,13 34.5,11" fill="white" />
      <text x="34" y="9.5" textAnchor="middle" fontSize="7" fill="#e6a020" fontFamily="monospace" fontWeight="bold">?</text>
    </svg>
  );
}

/** 여자 캐릭터 - 서있음 (출석만, 진찰 대기) */
function FemaleStanding({ color, initial }: { color: string; initial: string }) {
  return (
    <svg width="40" height="48" viewBox="0 0 40 48" style={{ imageRendering: 'pixelated' }}>
      {/* 바닥 그림자 */}
      <ellipse cx="20" cy="46" rx="10" ry="2" fill="#00000015" />

      {/* 다리 */}
      <rect x="14" y="36" width="5" height="8" fill="#4a6a8a" stroke="#2c4a6a" strokeWidth="0.8" />
      <rect x="21" y="36" width="5" height="8" fill="#4a6a8a" stroke="#2c4a6a" strokeWidth="0.8" />
      {/* 신발 */}
      <rect x="13" y="43" width="7" height="3" rx="1" fill="#8a5a6a" stroke="#6a3a4a" strokeWidth="0.7" />
      <rect x="20" y="43" width="7" height="3" rx="1" fill="#8a5a6a" stroke="#6a3a4a" strokeWidth="0.7" />

      {/* 머리카락 (어깨까지) */}
      <path d="M7,12 Q6,4 20,1 Q34,4 33,12 L33,30 Q33,32 30,32 L30,22 L10,22 L10,32 Q7,32 7,30 Z" fill="#5a3018" />

      {/* 몸통 - 분홍 블라우스 */}
      <rect x="9" y="22" width="22" height="16" rx="3" fill="#e88ca8" stroke="#c06080" strokeWidth="1.2" />
      <path d="M14,22 Q17,24 20,22 Q23,24 26,22" fill="none" stroke="white" strokeWidth="1" opacity="0.8" />
      <rect x="14" y="28" width="12" height="6" rx="1" fill="white" stroke="#c06080" strokeWidth="0.7" />
      <text x="20" y="33" textAnchor="middle" fontSize="5.5" fill="#c06080" fontFamily="monospace" fontWeight="bold">{initial}</text>

      {/* 머리 */}
      <circle cx="20" cy="14" r="10" fill="#fce4c0" stroke="#d4a06c" strokeWidth="1.2" />
      <path d="M10,14 L10,8 Q10,3 20,2 Q30,3 30,8 L30,14" fill="#5a3018" />
      <path d="M12,13 Q12,6 20,5 Q28,6 28,13" fill="#fce4c0" />
      <path d="M13,12 Q16,7 20,8 Q17,9 15,12" fill="#5a3018" />
      <path d="M27,12 Q24,7 20,8 Q23,9 25,12" fill="#5a3018" />
      <path d="M9,13 Q8,13 8,16 L8,22 Q8,23 9,23 L10,23 L10,14 Z" fill="#5a3018" />
      <path d="M31,13 Q32,13 32,16 L32,22 Q32,23 31,23 L30,23 L30,14 Z" fill="#5a3018" />

      {/* 리본 */}
      <circle cx="28" cy="5" r="2.5" fill="#ff6b9d" stroke="#d44a7a" strokeWidth="0.7" />
      <circle cx="28" cy="5" r="0.8" fill="#d44a7a" />

      {/* 눈 */}
      <ellipse cx="16" cy="13.5" rx="2" ry="2.3" fill="#2c2c2c" />
      <circle cx="16.8" cy="12.8" r="0.9" fill="white" />
      <circle cx="15.5" cy="14" r="0.4" fill="white" />
      <ellipse cx="24" cy="13.5" rx="2" ry="2.3" fill="#2c2c2c" />
      <circle cx="24.8" cy="12.8" r="0.9" fill="white" />
      <circle cx="23.5" cy="14" r="0.4" fill="white" />

      {/* 속눈썹 */}
      <line x1="13.5" y1="11.5" x2="14.5" y2="11" stroke="#2c2c2c" strokeWidth="0.5" />
      <line x1="25.5" y1="11" x2="26.5" y2="11.5" stroke="#2c2c2c" strokeWidth="0.5" />

      {/* 볼 */}
      <ellipse cx="12" cy="16" rx="2" ry="1.2" fill="#ffb0a0" opacity="0.5" />
      <ellipse cx="28" cy="16" rx="2" ry="1.2" fill="#ffb0a0" opacity="0.5" />

      {/* 입 - 약간 걱정 */}
      <path d="M18,18 L22,18" fill="none" stroke="#e07060" strokeWidth="0.7" />

      {/* ? 말풍선 */}
      <rect x="29" y="2" width="10" height="9" rx="2" fill="white" stroke="#5c4a3a" strokeWidth="0.8" />
      <polygon points="31,11 33,14 35,11" fill="white" stroke="#5c4a3a" strokeWidth="0.8" />
      <polygon points="31.5,11 33,13 34.5,11" fill="white" />
      <text x="34" y="9.5" textAnchor="middle" fontSize="7" fill="#e6a020" fontFamily="monospace" fontWeight="bold">?</text>
    </svg>
  );
}

/** 빈 좌석 (미출석) */
function EmptySeat({ initial }: { initial: string }) {
  return (
    <div className="relative w-10 h-12 flex items-center justify-center">
      <svg width="40" height="48" viewBox="0 0 40 48" style={{ imageRendering: 'pixelated' }}>
        {/* 책상 */}
        <rect x="3" y="34" width="34" height="11" fill="#c8c0b0" stroke="#a8a090" strokeWidth="1.2" />
        <rect x="5" y="36" width="30" height="7" fill="#d4ccbc" />

        {/* 빈 의자 */}
        <rect x="10" y="20" width="20" height="14" rx="2" fill="#d4d0c8" stroke="#b8b0a0" strokeWidth="1" />
        <rect x="10" y="17" width="20" height="5" rx="1" fill="#c8c4bc" stroke="#b8b0a0" strokeWidth="1" />

        {/* zzz */}
        <text x="29" y="14" fontSize="7" fill="#a8a090" opacity="0.6">z</text>
        <text x="32" y="9" fontSize="5.5" fill="#a8a090" opacity="0.4">z</text>
        <text x="34" y="5" fontSize="4" fill="#a8a090" opacity="0.25">z</text>

        {/* 이니셜 */}
        <text x="20" y="30" textAnchor="middle" fontSize="8" fill="#b8b0a0" fontFamily="monospace" fontWeight="bold">{initial}</text>
      </svg>
    </div>
  );
}

/** 덮인 책상 (예정 아님) */
function CoveredDesk({ initial }: { initial: string }) {
  return (
    <div className="relative w-10 h-12 flex items-center justify-center" style={{ opacity: 0.45 }}>
      <svg width="40" height="48" viewBox="0 0 40 48" style={{ imageRendering: 'pixelated' }}>
        {/* 책상 */}
        <rect x="3" y="34" width="34" height="11" fill="#b8b0a0" stroke="#a0988a" strokeWidth="1.2" />
        <rect x="5" y="36" width="30" height="7" fill="#c4bcac" />

        {/* 덮개 (천) */}
        <path
          d="M5,18 Q4,15 8,14 L32,14 Q36,15 35,18 L35,35 Q35,37 33,37 L7,37 Q5,37 5,35 Z"
          fill="#c8c0b8"
          stroke="#a8a098"
          strokeWidth="1"
        />
        {/* 천 주름 */}
        <path d="M10,20 Q15,18 20,20 Q25,22 30,20" fill="none" stroke="#b0a898" strokeWidth="0.8" />
        <path d="M8,28 Q14,26 20,28 Q26,30 32,28" fill="none" stroke="#b0a898" strokeWidth="0.8" />

        {/* 이니셜 (매우 흐리게) */}
        <text x="20" y="30" textAnchor="middle" fontSize="7" fill="#a8a098" fontFamily="monospace" fontWeight="bold" opacity="0.5">{initial}</text>

        {/* 달 아이콘 */}
        <text x="20" y="10" textAnchor="middle" fontSize="10" opacity="0.7">🌙</text>
      </svg>
    </div>
  );
}

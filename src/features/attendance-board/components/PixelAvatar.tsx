'use client';

import { getAvatarColor } from '../lib/avatar-color';

interface PixelAvatarProps {
  patientId: string;
  name: string;
  gender: 'M' | 'F' | null;
  attended: boolean;
  consulted?: boolean;
  hasTask?: boolean;
}

export function PixelAvatar({ patientId, name, gender, attended, consulted, hasTask }: PixelAvatarProps) {
  const color = getAvatarColor(patientId);
  const initial = name.charAt(0);
  const isMale = gender !== 'F';

  if (!attended) {
    return <EmptySeat initial={initial} />;
  }

  return (
    <div className="relative w-10 h-12 flex items-center justify-center">
      {isMale
        ? <MaleCharacter color={color} initial={initial} />
        : <FemaleCharacter color={color} initial={initial} />
      }

      {consulted && (
        <span
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[8px]"
          style={{
            backgroundColor: '#4ade80',
            border: '1.5px solid #166534',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          ✓
        </span>
      )}

      {hasTask && (
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
      )}
    </div>
  );
}

/** 남자 캐릭터 - 짧은 머리, 파란 옷, 넓은 어깨 */
function MaleCharacter({ color, initial }: { color: string; initial: string }) {
  return (
    <svg width="40" height="48" viewBox="0 0 40 48" style={{ imageRendering: 'pixelated' }}>
      {/* 책상 */}
      <rect x="3" y="34" width="34" height="11" fill="#b08a5c" stroke="#7a5c34" strokeWidth="1.2" />
      <rect x="5" y="36" width="30" height="7" fill="#c4a06c" />
      <rect x="24" y="37" width="8" height="4" fill="#e8e0d0" stroke="#a09080" strokeWidth="0.5" />

      {/* 몸통 - 파란 셔츠 */}
      <rect x="9" y="22" width="22" height="14" rx="3" fill="#4a90d9" stroke="#2c5a8a" strokeWidth="1.2" />
      {/* 셔츠 칼라 */}
      <polygon points="16,22 20,26 24,22" fill="#5aa0e9" stroke="#2c5a8a" strokeWidth="0.5" />
      {/* 이름표 */}
      <rect x="14" y="27" width="12" height="6" rx="1" fill="white" stroke="#2c5a8a" strokeWidth="0.7" />
      <text x="20" y="32" textAnchor="middle" fontSize="5.5" fill="#2c5a8a" fontFamily="monospace" fontWeight="bold">{initial}</text>

      {/* 머리 - 둥근 얼굴 */}
      <circle cx="20" cy="14" r="10" fill="#fce4c0" stroke="#d4a06c" strokeWidth="1.2" />

      {/* 남자 머리카락 - 짧고 깔끔 */}
      <path d="M10,14 L10,9 Q10,3 20,2 Q30,3 30,9 L30,14" fill="#3a2a1a" />
      <path d="M12,13 L12,10 Q12,5 20,4 Q28,5 28,10 L28,13" fill="#fce4c0" />
      {/* 앞머리 */}
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

      {/* 입 - 미소 */}
      <path d="M17,18 Q20,20 23,18" fill="none" stroke="#c07050" strokeWidth="0.8" />
    </svg>
  );
}

/** 여자 캐릭터 - 긴 머리(단발), 분홍 옷, 머리 리본 */
function FemaleCharacter({ color, initial }: { color: string; initial: string }) {
  return (
    <svg width="40" height="48" viewBox="0 0 40 48" style={{ imageRendering: 'pixelated' }}>
      {/* 책상 */}
      <rect x="3" y="34" width="34" height="11" fill="#b08a5c" stroke="#7a5c34" strokeWidth="1.2" />
      <rect x="5" y="36" width="30" height="7" fill="#c4a06c" />
      <rect x="24" y="37" width="8" height="4" fill="#e8e0d0" stroke="#a09080" strokeWidth="0.5" />

      {/* 머리카락 - 긴 머리 (어깨까지) */}
      <path d="M7,12 Q6,4 20,1 Q34,4 33,12 L33,28 Q33,30 30,30 L30,22 L10,22 L10,30 Q7,30 7,28 Z" fill="#5a3018" />

      {/* 몸통 - 분홍 블라우스 */}
      <rect x="9" y="22" width="22" height="14" rx="3" fill="#e88ca8" stroke="#c06080" strokeWidth="1.2" />
      {/* 블라우스 레이스 칼라 */}
      <path d="M14,22 Q17,24 20,22 Q23,24 26,22" fill="none" stroke="white" strokeWidth="1" opacity="0.8" />
      {/* 이름표 */}
      <rect x="14" y="27" width="12" height="6" rx="1" fill="white" stroke="#c06080" strokeWidth="0.7" />
      <text x="20" y="32" textAnchor="middle" fontSize="5.5" fill="#c06080" fontFamily="monospace" fontWeight="bold">{initial}</text>

      {/* 머리 - 둥근 얼굴 */}
      <circle cx="20" cy="14" r="10" fill="#fce4c0" stroke="#d4a06c" strokeWidth="1.2" />

      {/* 여자 앞머리 - 가르마 */}
      <path d="M10,14 L10,8 Q10,3 20,2 Q30,3 30,8 L30,14" fill="#5a3018" />
      <path d="M12,13 Q12,6 20,5 Q28,6 28,13" fill="#fce4c0" />
      {/* 앞머리 가르마 */}
      <path d="M13,12 Q16,7 20,8 Q17,9 15,12" fill="#5a3018" />
      <path d="M27,12 Q24,7 20,8 Q23,9 25,12" fill="#5a3018" />

      {/* 옆머리 (볼 옆으로 내려오는) */}
      <path d="M9,13 Q8,13 8,16 L8,22 Q8,23 9,23 L10,23 L10,14 Z" fill="#5a3018" />
      <path d="M31,13 Q32,13 32,16 L32,22 Q32,23 31,23 L30,23 L30,14 Z" fill="#5a3018" />

      {/* 리본 */}
      <circle cx="28" cy="5" r="2.5" fill="#ff6b9d" stroke="#d44a7a" strokeWidth="0.7" />
      <circle cx="28" cy="5" r="0.8" fill="#d44a7a" />

      {/* 눈 - 더 크고 반짝 (소녀 스타일) */}
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

      {/* 입 - 작은 미소 */}
      <path d="M18,18 Q20,19.5 22,18" fill="none" stroke="#e07060" strokeWidth="0.7" />
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

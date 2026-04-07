'use client';

interface PixelChairProps {
  empty?: boolean;
}

export function PixelChair({ empty = false }: PixelChairProps) {
  const seatColor = empty ? '#c8c4b8' : '#d4a574';
  const legColor = empty ? '#9e9a8e' : '#8b6e4e';
  const strokeColor = empty ? '#b8b4a8' : '#5c4a3a';

  return (
    <svg
      width="32"
      height="16"
      viewBox="0 0 32 16"
      className="mx-auto"
      style={{ imageRendering: 'pixelated' }}
      aria-hidden="true"
    >
      {/* 등받이 */}
      <rect x="6" y="0" width="20" height="4" fill={seatColor} stroke={strokeColor} strokeWidth="1" />
      {/* 방석 */}
      <rect x="4" y="4" width="24" height="5" fill={seatColor} stroke={strokeColor} strokeWidth="1" />
      {/* 쿠션 무늬 */}
      {!empty && <rect x="10" y="5.5" width="12" height="2" fill="#e8c49a" rx="0" />}
      {/* 다리 */}
      <rect x="6" y="9" width="3" height="6" fill={legColor} />
      <rect x="23" y="9" width="3" height="6" fill={legColor} />
    </svg>
  );
}

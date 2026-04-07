'use client';

/**
 * 탑뷰 복도 - 교실 행 사이의 타일 바닥
 * RPG 게임 스타일의 깔끔한 복도
 */
export function Hallway() {
  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{ height: 40 }}
    >
      {/* 복도 바닥 타일 */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            repeating-linear-gradient(
              90deg,
              #c4b08a 0px,
              #c4b08a 31px,
              #b8a47e 31px,
              #b8a47e 32px
            ),
            repeating-linear-gradient(
              0deg,
              #c4b08a 0px,
              #c4b08a 31px,
              #b8a47e 31px,
              #b8a47e 32px
            )
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* 벽 하단 라인 (교실 입구 위) */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: 4, backgroundColor: '#8a7560' }}
      />

      {/* 벽 상단 라인 (교실 입구 아래) */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 4, backgroundColor: '#8a7560' }}
      />

      {/* 바닥 중앙선 */}
      <div
        className="absolute top-1/2 left-0 right-0 -translate-y-1/2"
        style={{
          height: 2,
          background: 'repeating-linear-gradient(90deg, #a89474 0px, #a89474 12px, transparent 12px, transparent 20px)',
        }}
      />
    </div>
  );
}

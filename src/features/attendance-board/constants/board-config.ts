/** 출석 보드 설정 */
export const BOARD_CONFIG = {
  /** 좌석 그리드 열 수 */
  SEAT_COLUMNS: 4,
  /** 자동 갱신 주기 (ms) */
  REFETCH_INTERVAL: 30_000,
  /** 픽셀 폰트 패밀리 */
  PIXEL_FONT: "'DungGeunMo', 'Press Start 2P', monospace",
} as const;

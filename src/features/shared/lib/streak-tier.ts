/** 스트릭 등급 (낮병원 연속 출석/진찰 게이미피케이션) */
export type StreakTier = 'none' | 'fire' | 'lightning' | 'diamond' | 'crown' | 'myth';

/** 등급 임계값 (연속 출석 일수) — 단일 출처 */
export const STREAK_THRESHOLDS: ReadonlyArray<{ tier: Exclude<StreakTier, 'none'>; min: number }> = [
  { tier: 'myth', min: 30 },
  { tier: 'crown', min: 20 },
  { tier: 'diamond', min: 10 },
  { tier: 'lightning', min: 5 },
  { tier: 'fire', min: 3 },
];

/** 스트릭 뱃지 표시 최소 일수 */
export const STREAK_BADGE_MIN = 3;

/** 연속 일수 → 등급 */
export function getStreakTier(streak: number): StreakTier {
  for (const { tier, min } of STREAK_THRESHOLDS) {
    if (streak >= min) return tier;
  }
  return 'none';
}

/** 등급별 UI 메타 (아이콘/색상/라벨) — 단일 출처 */
export const STREAK_TIER_META: Record<
  Exclude<StreakTier, 'none'>,
  { icon: string; bg: string; border: string; text: string; label: string }
> = {
  fire: { icon: '🔥', bg: '#fff3e0', border: '#e65100', text: '#e65100', label: '시작!' },
  lightning: { icon: '⚡', bg: '#fff8e1', border: '#f9a825', text: '#f57f17', label: '달리는 중!' },
  diamond: { icon: '💎', bg: '#e3f2fd', border: '#1565c0', text: '#0d47a1', label: '다이아몬드!' },
  crown: { icon: '👑', bg: '#fff8e1', border: '#ff8f00', text: '#e65100', label: '전설!' },
  myth: { icon: '🌟', bg: 'linear-gradient(90deg, #fce4ec, #e8eaf6, #e0f7fa)', border: '#7b1fa2', text: '#4a148c', label: '신화!' },
};

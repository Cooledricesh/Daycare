'use client';

import { getStreakTier, STREAK_TIER_META, STREAK_BADGE_MIN } from '@/features/shared/lib/streak-tier';

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

/**
 * 목록용 압축 스트릭 뱃지. streak < 3 이면 렌더링하지 않음.
 * 예: 🔥3, ⚡7, 💎12
 */
export function StreakBadge({ streak, className }: StreakBadgeProps) {
  if (streak < STREAK_BADGE_MIN) return null;
  const tier = getStreakTier(streak);
  if (tier === 'none') return null;
  const meta = STREAK_TIER_META[tier];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 4px',
        borderRadius: 9999,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.text,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
      }}
      aria-label={`${streak}일 연속 출석`}
      title={`${streak}일 연속 출석 ${meta.label}`}
    >
      {meta.icon}{streak}
    </span>
  );
}

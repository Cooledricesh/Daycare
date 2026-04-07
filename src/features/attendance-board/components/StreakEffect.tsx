'use client';

import type { StreakTier } from '../backend/schema';

interface StreakEffectProps {
  tier: StreakTier;
  streak: number;
  consultationStreak: number;
  children: React.ReactNode;
}

/**
 * 스트릭 등급별 이펙트 래퍼
 * - none: 이펙트 없음
 * - fire (3+): 불꽃 파티클
 * - lightning (5+): 번개 오라
 * - diamond (10+): 다이아몬드 오라
 * - crown (20+): 황금 왕관 + 무지개
 * - myth (30+): 무지개 후광 + 떠있음
 */
export function StreakEffect({ tier, streak, consultationStreak, children }: StreakEffectProps) {
  if (tier === 'none') {
    return <div className="relative">{children}</div>;
  }

  return (
    <div className="relative">
      {/* 오라 / 후광 */}
      <div
        className="absolute inset-0 -m-1 pointer-events-none"
        style={getAuraStyle(tier)}
      />

      {/* 캐릭터 (myth 등급은 살짝 떠있음) */}
      <div style={tier === 'myth' ? { animation: 'mythFloat 2s ease-in-out infinite' } : undefined}>
        {children}
      </div>

      {/* 파티클 */}
      <Particles tier={tier} />

      {/* 스트릭 카운터 뱃지 */}
      <StreakBadge tier={tier} streak={streak} />

      {/* 진찰 스트릭 하트 */}
      {consultationStreak >= 3 && (
        <HeartEffect large={consultationStreak >= 7} />
      )}
    </div>
  );
}

/** 등급별 오라 스타일 */
function getAuraStyle(tier: StreakTier): React.CSSProperties {
  switch (tier) {
    case 'fire':
      return {
        borderRadius: '50%',
        animation: 'fireGlow 1.5s ease-in-out infinite',
      };
    case 'lightning':
      return {
        borderRadius: '50%',
        animation: 'lightningGlow 1s ease-in-out infinite',
      };
    case 'diamond':
      return {
        borderRadius: '50%',
        animation: 'diamondGlow 2s ease-in-out infinite',
      };
    case 'crown':
      return {
        borderRadius: '50%',
        animation: 'crownGlow 2s ease-in-out infinite',
      };
    case 'myth':
      return {
        borderRadius: '50%',
        animation: 'mythGlow 3s ease-in-out infinite',
      };
    default:
      return {};
  }
}

/** 파티클 이펙트 */
function Particles({ tier }: { tier: StreakTier }) {
  const config = PARTICLE_CONFIG[tier];
  if (!config) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {Array.from({ length: config.count }).map((_, i) => (
        <span
          key={i}
          className="absolute text-[8px]"
          style={{
            left: `${20 + Math.sin(i * 2.4) * 18}px`,
            top: `${10 + Math.cos(i * 2.4) * 12}px`,
            animation: `particleFloat ${1.5 + (i % 3) * 0.5}s ease-in-out ${i * 0.3}s infinite`,
            opacity: 0.8,
          }}
        >
          {config.emoji}
        </span>
      ))}
    </div>
  );
}

const PARTICLE_CONFIG: Partial<Record<StreakTier, { emoji: string; count: number }>> = {
  fire: { emoji: '🔥', count: 2 },
  lightning: { emoji: '⚡', count: 3 },
  diamond: { emoji: '💎', count: 3 },
  crown: { emoji: '⭐', count: 4 },
  myth: { emoji: '✨', count: 5 },
};

/** 스트릭 카운터 뱃지 */
function StreakBadge({ tier, streak }: { tier: StreakTier; streak: number }) {
  const colors = BADGE_COLORS[tier];
  if (!colors) return null;

  return (
    <div
      className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1 py-0 z-10"
      style={{
        backgroundColor: colors.bg,
        border: `1.5px solid ${colors.border}`,
        fontSize: 7,
        fontWeight: 'bold',
        color: colors.text,
        whiteSpace: 'nowrap',
        lineHeight: '12px',
      }}
    >
      {colors.icon}{streak}
    </div>
  );
}

const BADGE_COLORS: Partial<Record<StreakTier, { bg: string; border: string; text: string; icon: string }>> = {
  fire: { bg: '#fff3e0', border: '#e65100', text: '#e65100', icon: '🔥' },
  lightning: { bg: '#fff8e1', border: '#f9a825', text: '#f57f17', icon: '⚡' },
  diamond: { bg: '#e3f2fd', border: '#1565c0', text: '#0d47a1', icon: '💎' },
  crown: { bg: '#fff8e1', border: '#ff8f00', text: '#e65100', icon: '👑' },
  myth: { bg: 'linear-gradient(90deg, #fce4ec, #e8eaf6, #e0f7fa)', border: '#7b1fa2', text: '#4a148c', icon: '🌟' },
};

/** 진찰 스트릭 하트 이펙트 */
function HeartEffect({ large }: { large: boolean }) {
  return (
    <div
      className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{
        animation: 'heartBeat 1.5s ease-in-out infinite',
        fontSize: large ? 12 : 9,
      }}
    >
      ♥
    </div>
  );
}

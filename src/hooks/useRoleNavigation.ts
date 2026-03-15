import { useAuth } from '@/hooks/useAuth';
import { ROLE_CONFIG, type NavItem } from '@/constants/navigation';

const FALLBACK = { navItems: [] as NavItem[], title: '낮병원' };

export function useRoleNavigation() {
  const { user } = useAuth();

  if (!user) return FALLBACK;

  return ROLE_CONFIG[user.role] ?? FALLBACK;
}

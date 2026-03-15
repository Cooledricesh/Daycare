'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { useRoleNavigation } from '@/hooks/useRoleNavigation';

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  const { navItems, title } = useRoleNavigation();
  return <AppLayout navItems={navItems} title={title}>{children}</AppLayout>;
}

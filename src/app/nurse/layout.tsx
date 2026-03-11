'use client';

import { ReactNode } from 'react';
import { Users, ClipboardList, HeartPulse, BarChart3, KeyRound } from 'lucide-react';
import { AppLayout, type NavItem } from '@/components/layout/AppLayout';

type NurseLayoutProps = {
  children: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: '/nurse/prescriptions',
    label: '환자 관리',
    icon: Users,
  },
  {
    href: '/nurse/tasks',
    label: '처리 필요 항목',
    icon: ClipboardList,
  },
  {
    href: '/shared/vitals',
    label: '활력징후',
    icon: HeartPulse,
  },
  {
    href: '/shared/stats',
    label: '통계',
    icon: BarChart3,
  },
  {
    href: '/shared/change-password',
    label: '비밀번호 변경',
    icon: KeyRound,
  },
];

export default function NurseLayout({ children }: NurseLayoutProps) {
  return (
    <AppLayout navItems={navItems} title="낮병원">
      {children}
    </AppLayout>
  );
}

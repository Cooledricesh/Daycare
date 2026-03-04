'use client';

import { ReactNode } from 'react';
import { Users, Calendar, BarChart3, KeyRound } from 'lucide-react';
import { AppLayout, type NavItem } from '@/components/layout/AppLayout';

type StaffLayoutProps = {
  children: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: '/staff/dashboard',
    label: '담당 환자',
    icon: Users,
  },
  {
    href: '/staff/schedule',
    label: '출석 일정',
    icon: Calendar,
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

export default function StaffLayout({ children }: StaffLayoutProps) {
  return (
    <AppLayout navItems={navItems} title="낮병원">
      {children}
    </AppLayout>
  );
}

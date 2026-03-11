'use client';

import { ReactNode } from 'react';
import { Stethoscope, ClipboardList, HeartPulse, BarChart3, KeyRound } from 'lucide-react';
import { AppLayout, type NavItem } from '@/components/layout/AppLayout';

type DoctorLayoutProps = {
  children: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: '/doctor/consultation',
    label: '진료실',
    icon: Stethoscope,
  },
  {
    href: '/doctor/tasks',
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

export default function DoctorLayout({ children }: DoctorLayoutProps) {
  return (
    <AppLayout navItems={navItems} title="낮병원">
      {children}
    </AppLayout>
  );
}

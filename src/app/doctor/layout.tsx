'use client';

import { ReactNode } from 'react';
import { Stethoscope, ClipboardList } from 'lucide-react';
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
];

export default function DoctorLayout({ children }: DoctorLayoutProps) {
  return (
    <AppLayout navItems={navItems} title="낮병원">
      {children}
    </AppLayout>
  );
}

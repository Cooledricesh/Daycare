'use client';

import { ReactNode } from 'react';
import { Pill } from 'lucide-react';
import { AppLayout, type NavItem } from '@/components/layout/AppLayout';

type NurseLayoutProps = {
  children: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: '/nurse/prescriptions',
    label: '처방 변경 목록',
    icon: Pill,
  },
];

export default function NurseLayout({ children }: NurseLayoutProps) {
  return (
    <AppLayout navItems={navItems} title="낮병원">
      <div className="p-6">
        {children}
      </div>
    </AppLayout>
  );
}

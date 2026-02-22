'use client';

import { ReactNode } from 'react';
import { Users } from 'lucide-react';
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
];

export default function NurseLayout({ children }: NurseLayoutProps) {
  return (
    <AppLayout navItems={navItems} title="낮병원">
      {children}
    </AppLayout>
  );
}

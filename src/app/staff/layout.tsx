'use client';

import { ReactNode } from 'react';
import { LayoutDashboard, MessageSquare, Users, Calendar } from 'lucide-react';
import { AppLayout, type NavItem } from '@/components/layout/AppLayout';

type StaffLayoutProps = {
  children: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: '/staff/dashboard',
    label: '대시보드',
    icon: LayoutDashboard,
  },
  {
    href: '/staff/patients',
    label: '담당 환자',
    icon: Users,
  },
  {
    href: '/staff/schedule',
    label: '출석 일정',
    icon: Calendar,
  },
  {
    href: '/staff/messages',
    label: '전달사항',
    icon: MessageSquare,
  },
];

export default function StaffLayout({ children }: StaffLayoutProps) {
  return (
    <AppLayout navItems={navItems} title="낮병원">
      <div className="p-6">
        {children}
      </div>
    </AppLayout>
  );
}

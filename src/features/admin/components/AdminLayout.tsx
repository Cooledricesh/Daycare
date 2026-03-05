'use client';

import {
  LayoutDashboard,
  Users,
  UserCog,
  Calendar,
  ClipboardList,
  BarChart3,
  Settings,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import { AppLayout, type NavItem } from '@/components/layout/AppLayout';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: '/admin/dashboard',
    label: '대시보드',
    icon: LayoutDashboard,
  },
  {
    href: '/admin/patients',
    label: '환자 관리',
    icon: Users,
  },
  {
    href: '/admin/staff',
    label: '직원 관리',
    icon: UserCog,
  },
  {
    href: '/admin/schedule',
    label: '스케줄 관리',
    icon: Calendar,
  },
  {
    href: '/admin/tasks',
    label: '처리 필요 항목',
    icon: ClipboardList,
  },
  {
    href: '/admin/stats',
    label: '통계',
    icon: BarChart3,
  },
  {
    href: '/admin/sync',
    label: '데이터 동기화',
    icon: RefreshCw,
  },
  {
    href: '/admin/settings/room-mapping',
    label: '호실 매핑',
    icon: Settings,
  },
  {
    href: '/shared/change-password',
    label: '비밀번호 변경',
    icon: KeyRound,
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AppLayout navItems={navItems} title="낮병원 관리">
      {children}
    </AppLayout>
  );
}

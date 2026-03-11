'use client';

import { ReactNode } from 'react';
import {
  Stethoscope,
  ClipboardList,
  Users,
  Calendar,
  LayoutDashboard,
  UserCog,
  BarChart3,
  Settings,
  RefreshCw,
  KeyRound,
  HeartPulse,
} from 'lucide-react';
import { AppLayout, type NavItem } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';

const sharedNavItems: NavItem[] = [
  { href: '/shared/vitals', label: '활력징후', icon: HeartPulse },
  { href: '/shared/stats', label: '통계', icon: BarChart3 },
  { href: '/shared/change-password', label: '비밀번호 변경', icon: KeyRound },
];

const roleNavItems: Record<string, NavItem[]> = {
  doctor: [
    { href: '/doctor/consultation', label: '진료실', icon: Stethoscope },
    { href: '/doctor/tasks', label: '처리 필요 항목', icon: ClipboardList },
  ],
  nurse: [
    { href: '/nurse/prescriptions', label: '환자 관리', icon: Users },
  ],
  coordinator: [
    { href: '/staff/dashboard', label: '담당 환자', icon: Users },
    { href: '/staff/schedule', label: '출석 일정', icon: Calendar },
  ],
  admin: [
    { href: '/admin/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/admin/patients', label: '환자 관리', icon: Users },
    { href: '/admin/staff', label: '직원 관리', icon: UserCog },
    { href: '/admin/schedule', label: '스케줄 관리', icon: Calendar },
    { href: '/admin/stats', label: '통계', icon: BarChart3 },
    { href: '/admin/sync', label: '데이터 동기화', icon: RefreshCw },
    { href: '/admin/settings/room-mapping', label: '호실 매핑', icon: Settings },
  ],
};

export default function SharedLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const role = user?.role || '';

  const navItems = [
    ...(roleNavItems[role] || []),
    ...sharedNavItems,
  ];

  const title = role === 'admin' ? '낮병원 관리' : '낮병원';

  return (
    <AppLayout navItems={navItems} title={title}>
      {children}
    </AppLayout>
  );
}

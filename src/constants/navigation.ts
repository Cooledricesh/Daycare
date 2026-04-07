import {
  LayoutDashboard,
  Gamepad2,
  Users,
  UserCog,
  UsersRound,
  Calendar,
  ClipboardList,
  HeartPulse,
  UserX,
  BarChart3,
  Settings,
  RefreshCw,
  KeyRound,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { type UserRole } from '@/types/api';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface RoleConfig {
  navItems: NavItem[];
  title: string;
}

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  admin: {
    title: '낮병원 관리',
    navItems: [
      { href: '/admin/dashboard', label: '대시보드', icon: LayoutDashboard },
      { href: '/admin/patients', label: '환자 관리', icon: Users },
      { href: '/admin/staff', label: '직원 관리', icon: UserCog },
      { href: '/admin/staff-workload', label: '직원 워크로드', icon: UsersRound },
      { href: '/admin/schedule', label: '스케줄 관리', icon: Calendar },
      { href: '/admin/tasks', label: '처리 필요 항목', icon: ClipboardList },
      { href: '/admin/stats', label: '통계', icon: BarChart3 },
      { href: '/admin/sync', label: '데이터 동기화', icon: RefreshCw },
      { href: '/admin/settings/room-mapping', label: '호실 매핑', icon: Settings },
      { href: '/shared/attendance-board', label: '출석 보드', icon: Gamepad2 },
      { href: '/shared/absence-risk', label: '결석 관리', icon: UserX },
      { href: '/shared/vitals', label: '활력징후', icon: HeartPulse },
      { href: '/shared/change-password', label: '비밀번호 변경', icon: KeyRound },
    ],
  },
  doctor: {
    title: '낮병원',
    navItems: [
      { href: '/doctor/consultation', label: '진료실', icon: Stethoscope },
      { href: '/doctor/tasks', label: '처리 필요 항목', icon: ClipboardList },
      { href: '/shared/attendance-board', label: '출석 보드', icon: Gamepad2 },
      { href: '/shared/absence-risk', label: '결석 관리', icon: UserX },
      { href: '/shared/vitals', label: '활력징후', icon: HeartPulse },
      { href: '/shared/stats', label: '통계', icon: BarChart3 },
      { href: '/shared/change-password', label: '비밀번호 변경', icon: KeyRound },
    ],
  },
  nurse: {
    title: '낮병원',
    navItems: [
      { href: '/nurse/prescriptions', label: '환자 관리', icon: Users },
      { href: '/nurse/tasks', label: '처리 필요 항목', icon: ClipboardList },
      { href: '/shared/attendance-board', label: '출석 보드', icon: Gamepad2 },
      { href: '/shared/absence-risk', label: '결석 관리', icon: UserX },
      { href: '/shared/vitals', label: '활력징후', icon: HeartPulse },
      { href: '/shared/stats', label: '통계', icon: BarChart3 },
      { href: '/shared/change-password', label: '비밀번호 변경', icon: KeyRound },
    ],
  },
  coordinator: {
    title: '낮병원',
    navItems: [
      { href: '/staff/dashboard', label: '담당 환자', icon: Users },
      { href: '/shared/attendance-board', label: '출석 보드', icon: Gamepad2 },
      { href: '/staff/schedule', label: '출석 일정', icon: Calendar },
      { href: '/staff/tasks', label: '처리 필요 항목', icon: ClipboardList },
      { href: '/shared/absence-risk', label: '결석 관리', icon: UserX },
      { href: '/shared/vitals', label: '활력징후', icon: HeartPulse },
      { href: '/shared/stats', label: '통계', icon: BarChart3 },
      { href: '/shared/change-password', label: '비밀번호 변경', icon: KeyRound },
    ],
  },
};

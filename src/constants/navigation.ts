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
  Syringe,
  FileBarChart,
  type LucideIcon,
} from 'lucide-react';
import { type UserRole } from '@/types/api';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

interface RoleConfig {
  navItems: NavItem[];
  title: string;
}

const CARESCHEDULER_WEB_URL =
  process.env.NEXT_PUBLIC_CARESCHEDULER_WEB_URL ?? 'https://careschedulerp.vercel.app';

const careschedulerNavItem: NavItem = {
  href: CARESCHEDULER_WEB_URL,
  label: 'Carescheduler',
  icon: Syringe,
  external: true,
};

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  admin: {
    title: '낮병원 관리',
    navItems: [
      { href: '/dashboard/admin', label: '대시보드', icon: LayoutDashboard },
      { href: '/dashboard/admin/patients', label: '환자 관리', icon: Users },
      { href: '/dashboard/admin/staff', label: '직원 관리', icon: UserCog },
      { href: '/dashboard/admin/staff-workload', label: '직원 워크로드', icon: UsersRound },
      { href: '/dashboard/admin/schedule', label: '스케줄 관리', icon: Calendar },
      { href: '/dashboard/admin/tasks', label: '처리 필요 항목', icon: ClipboardList },
      { href: '/dashboard/admin/stats', label: '통계', icon: BarChart3 },
      { href: '/dashboard/admin/monthly-report', label: '월간 리포트', icon: FileBarChart },
      { href: '/dashboard/admin/sync', label: '데이터 동기화', icon: RefreshCw },
      { href: '/dashboard/admin/settings/room-mapping', label: '호실 매핑', icon: Settings },
      { href: '/shared/attendance-board', label: '출석 보드', icon: Gamepad2 },
      { href: '/shared/absence-risk', label: '결석 관리', icon: UserX },
      { href: '/shared/vitals', label: '활력징후', icon: HeartPulse },
      careschedulerNavItem,
      { href: '/shared/change-password', label: '비밀번호 변경', icon: KeyRound },
    ],
  },
  doctor: {
    title: '낮병원',
    navItems: [
      { href: '/dashboard/doctor', label: '진료실', icon: Stethoscope },
      { href: '/dashboard/doctor/tasks', label: '처리 필요 항목', icon: ClipboardList },
      { href: '/shared/attendance-board', label: '출석 보드', icon: Gamepad2 },
      { href: '/shared/absence-risk', label: '결석 관리', icon: UserX },
      { href: '/shared/vitals', label: '활력징후', icon: HeartPulse },
      { href: '/shared/stats', label: '통계', icon: BarChart3 },
      careschedulerNavItem,
      { href: '/shared/change-password', label: '비밀번호 변경', icon: KeyRound },
    ],
  },
  nurse: {
    title: '낮병원',
    navItems: [
      { href: '/dashboard/nurse', label: '환자 관리', icon: Users },
      { href: '/dashboard/nurse/tasks', label: '처리 필요 항목', icon: ClipboardList },
      { href: '/shared/attendance-board', label: '출석 보드', icon: Gamepad2 },
      { href: '/shared/absence-risk', label: '결석 관리', icon: UserX },
      { href: '/shared/vitals', label: '활력징후', icon: HeartPulse },
      { href: '/shared/stats', label: '통계', icon: BarChart3 },
      careschedulerNavItem,
      { href: '/shared/change-password', label: '비밀번호 변경', icon: KeyRound },
    ],
  },
  coordinator: {
    title: '낮병원',
    navItems: [
      { href: '/dashboard/staff', label: '담당 환자', icon: Users },
      { href: '/shared/attendance-board', label: '출석 보드', icon: Gamepad2 },
      { href: '/dashboard/staff/schedule', label: '출석 일정', icon: Calendar },
      { href: '/dashboard/staff/tasks', label: '처리 필요 항목', icon: ClipboardList },
      { href: '/shared/absence-risk', label: '결석 관리', icon: UserX },
      { href: '/shared/vitals', label: '활력징후', icon: HeartPulse },
      { href: '/shared/stats', label: '통계', icon: BarChart3 },
      careschedulerNavItem,
      { href: '/shared/change-password', label: '비밀번호 변경', icon: KeyRound },
    ],
  },
};

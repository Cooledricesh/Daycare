'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Users,
  UserCog,
  Calendar,
  BarChart3,
  LogOut,
  User,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { useLogout } from '@/hooks/useLogout';
import { useAuth } from '@/hooks/useAuth';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
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
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const { logout } = useLogout();
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">주간보호센터</h1>
        </div>

        <nav className="p-4 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          {user && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>{user.name}</span>
              <span className="text-xs text-gray-400">(관리자)</span>
            </div>
          )}
          <button
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={logout}
          >
            <LogOut className="h-5 w-5" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

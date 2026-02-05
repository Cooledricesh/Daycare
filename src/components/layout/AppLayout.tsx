'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LogOut, User, type LucideIcon } from 'lucide-react';
import { useLogout } from '@/hooks/useLogout';
import { useAuth } from '@/hooks/useAuth';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface AppLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  title?: string;
}

// 역할별 한글 라벨
const roleLabels: Record<string, string> = {
  admin: '관리자',
  coordinator: '코디네이터',
  doctor: '의사',
  nurse: '간호사',
};

// 역할별 테마 색상
const roleColors: Record<string, { bg: string; text: string; activeBg: string; activeText: string }> = {
  admin: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    activeBg: 'bg-blue-50',
    activeText: 'text-blue-700',
  },
  coordinator: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    activeBg: 'bg-emerald-50',
    activeText: 'text-emerald-700',
  },
  doctor: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    activeBg: 'bg-purple-50',
    activeText: 'text-purple-700',
  },
  nurse: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    activeBg: 'bg-rose-50',
    activeText: 'text-rose-700',
  },
};

export function AppLayout({ children, navItems, title = '낮병원' }: AppLayoutProps) {
  const pathname = usePathname();
  const { logout } = useLogout();
  const { user } = useAuth();

  const colors = roleColors[user?.role || 'admin'] || roleColors.admin;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
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
                    ? `${colors.activeBg} ${colors.activeText}`
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
              <span className={cn('text-xs', colors.text)}>
                ({roleLabels[user.role] || user.role})
              </span>
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

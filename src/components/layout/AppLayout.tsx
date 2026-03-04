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
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
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

      {/* Mobile Top Header — visible only on mobile */}
      <div className="fixed top-0 left-0 right-0 z-30 md:hidden bg-white border-b border-gray-200">
        <div className="h-12 flex items-center justify-between px-4">
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          {user && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{user.name}</span>
              <span className={cn(colors.text)}>
                ({roleLabels[user.role] || user.role})
              </span>
              <button
                onClick={logout}
                className="ml-1 p-1 rounded-md hover:bg-gray-100 text-gray-400"
                aria-label="로그아웃"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-12 pb-16 md:pt-0 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Tab Navigation — visible only on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white border-t border-gray-200">
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isActive
                    ? `${colors.activeText}`
                    : 'text-gray-400'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && colors.activeText)} />
                <span className="truncate max-w-[72px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

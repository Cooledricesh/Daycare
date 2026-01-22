'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useLogout } from '@/hooks/useLogout';
import { useAuth } from '@/hooks/useAuth';

type NurseLayoutProps = {
  children: ReactNode;
};

export default function NurseLayout({ children }: NurseLayoutProps) {
  const { logout } = useLogout();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/nurse/prescriptions" className="font-bold text-lg">
              낮병원 (간호사)
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <User className="h-4 w-4" />
                {user.name}
              </span>
            )}
            {mounted && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>메뉴</SheetTitle>
                    <SheetDescription>
                      {user ? `${user.name}님으로 로그인됨` : ''}
                    </SheetDescription>
                  </SheetHeader>
                  <nav className="flex flex-col gap-2 mt-4">
                    <Link href="/nurse/prescriptions">
                      <Button variant="ghost" className="w-full justify-start">
                        처방 변경 목록
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={logout}
                    >
                      로그아웃
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">{children}</main>
    </div>
  );
}

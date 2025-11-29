'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

type StaffLayoutProps = {
  children: ReactNode;
};

export default function StaffLayout({ children }: StaffLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/staff/dashboard" className="font-bold text-lg">
              낮병원
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>메뉴</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-2 mt-4">
                  <Link href="/staff/dashboard">
                    <Button variant="ghost" className="w-full justify-start">
                      대시보드
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="ghost" className="w-full justify-start">
                      로그아웃
                    </Button>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">{children}</main>
    </div>
  );
}

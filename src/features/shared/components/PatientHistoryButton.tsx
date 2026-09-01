'use client';

import Link from 'next/link';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PatientHistoryRole = 'doctor' | 'admin' | 'nurse' | 'coordinator';

const dashboardSegment: Record<PatientHistoryRole, string> = {
  doctor: 'doctor',
  admin: 'admin',
  nurse: 'nurse',
  coordinator: 'staff',
};

interface PatientHistoryButtonProps {
  role: PatientHistoryRole;
  patientId: string;
}

export function PatientHistoryButton({ role, patientId }: PatientHistoryButtonProps) {
  const href = `/dashboard/${dashboardSegment[role]}/history/${patientId}`;

  return (
    <Link href={href} aria-label="전체 히스토리">
      <Button variant="outline" size="sm">
        <History className="w-4 h-4 mr-1" />
        전체 히스토리
      </Button>
    </Link>
  );
}

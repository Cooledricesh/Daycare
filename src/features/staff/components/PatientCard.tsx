'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import type { PatientSummary } from '../backend/schema';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type PatientCardProps = {
  patient: PatientSummary;
};

export function PatientCard({ patient }: PatientCardProps) {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{patient.name}</h3>
            {patient.has_task && !patient.task_completed && (
              <Bell className="w-5 h-5 text-orange-500" />
            )}
          </div>
          <Link href={`/staff/patient/${patient.id}`}>
            <Button variant="outline" size="sm">
              상세
            </Button>
          </Link>
        </div>

        <div className="flex gap-2 mb-2">
          <Badge variant={patient.is_attended ? 'default' : 'secondary'}>
            출석 {patient.is_attended ? '✓' : '✗'}
          </Badge>
          <Badge variant={patient.is_consulted ? 'default' : 'secondary'}>
            진찰 {patient.is_consulted ? '✓' : '⏳'}
          </Badge>
        </div>

        {patient.has_task && (
          <div className="mt-2 text-sm">
            <p className="text-gray-600">
              지시: {patient.task_content || '-'}
            </p>
          </div>
        )}

        {patient.attendance_time && (
          <p className="text-xs text-gray-500 mt-1">
            {format(new Date(patient.attendance_time), 'HH:mm', { locale: ko })}{' '}
            출석
          </p>
        )}
      </CardContent>
    </Card>
  );
}

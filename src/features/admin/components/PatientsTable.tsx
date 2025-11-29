'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit } from 'lucide-react';
import type { PatientWithCoordinator } from '../backend/schema';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface PatientsTableProps {
  patients: PatientWithCoordinator[];
  onEdit: (patient: PatientWithCoordinator) => void;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  active: { label: '활성', variant: 'default' },
  discharged: { label: '퇴원', variant: 'secondary' },
  suspended: { label: '중단', variant: 'destructive' },
};

const genderLabels: Record<string, string> = {
  M: '남',
  F: '여',
};

export function PatientsTable({ patients, onEdit }: PatientsTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>생년월일</TableHead>
            <TableHead>성별</TableHead>
            <TableHead>담당 코디</TableHead>
            <TableHead>출석 패턴</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="w-[100px]">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                환자가 없습니다
              </TableCell>
            </TableRow>
          ) : (
            patients.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell className="font-medium">{patient.name}</TableCell>
                <TableCell>
                  {patient.birth_date
                    ? format(new Date(patient.birth_date), 'yyyy-MM-dd', { locale: ko })
                    : '-'}
                </TableCell>
                <TableCell>
                  {patient.gender ? genderLabels[patient.gender] : '-'}
                </TableCell>
                <TableCell>{patient.coordinator_name || '-'}</TableCell>
                <TableCell>
                  {patient.schedule_pattern ? (
                    <div className="flex gap-1">
                      {patient.schedule_pattern.split(',').map((day, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {day}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">미설정</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusLabels[patient.status].variant}>
                    {statusLabels[patient.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(patient)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

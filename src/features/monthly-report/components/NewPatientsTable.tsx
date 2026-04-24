'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { NewPatientEntry } from '../lib/dto';

interface NewPatientsTableProps {
  newPatients: NewPatientEntry[];
}

export function NewPatientsTable({ newPatients }: NewPatientsTableProps) {
  if (newPatients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">신규 환자 정착도</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">이번 달 신규 등록 환자 없음</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">신규 환자 정착도</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>등록일</TableHead>
              <TableHead className="text-right">출석일수</TableHead>
              <TableHead className="text-right">가능 출석일수</TableHead>
              <TableHead className="text-right">정착률</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newPatients.map((entry) => {
              const rate = entry.possible_days > 0
                ? ((entry.attendance_days / entry.possible_days) * 100).toFixed(1)
                : '0.0';
              return (
                <TableRow key={entry.patient_id}>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {format(parseISO(entry.registered_date), 'MM/dd', { locale: ko })}
                  </TableCell>
                  <TableCell className="text-right">{entry.attendance_days}일</TableCell>
                  <TableCell className="text-right">{entry.possible_days}일</TableCell>
                  <TableCell className="text-right">{rate}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

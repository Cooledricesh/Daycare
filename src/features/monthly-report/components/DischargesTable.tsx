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
import { DischargeTypeBadge } from './DischargeTypeBadge';
import type { DischargeEntry } from '../lib/dto';

interface DischargesTableProps {
  discharges: DischargeEntry[];
}

export function DischargesTable({ discharges }: DischargesTableProps) {
  if (discharges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">퇴원 환자</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">이번 달 퇴원 환자 없음</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">퇴원 환자</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>퇴원일</TableHead>
              <TableHead>유형</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discharges.map((entry, index) => (
              <TableRow key={entry.patient_id ?? `${entry.patient_id_no}-${index}`}>
                <TableCell className="font-medium">{entry.name}</TableCell>
                <TableCell className="text-sm text-gray-500">
                  {format(parseISO(entry.discharge_date), 'MM/dd', { locale: ko })}
                </TableCell>
                <TableCell>
                  <DischargeTypeBadge type={entry.type} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

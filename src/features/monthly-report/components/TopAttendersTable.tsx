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
import type { TopAttenderEntry } from '../lib/dto';

interface TopAttendersTableProps {
  topAttenders: TopAttenderEntry[];
}

export function TopAttendersTable({ topAttenders }: TopAttendersTableProps) {
  if (topAttenders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">출석 우수 환자</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">데이터 없음</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">출석 우수 환자 (상위 {topAttenders.length}명)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>이름</TableHead>
              <TableHead className="text-right">출석일수</TableHead>
              <TableHead className="text-right">출석률</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topAttenders.map((entry, index) => (
              <TableRow key={entry.patient_id}>
                <TableCell className="text-gray-400 text-sm">{index + 1}</TableCell>
                <TableCell className="font-medium">{entry.name}</TableCell>
                <TableCell className="text-right">{entry.attendance_days}일</TableCell>
                <TableCell className="text-right">{Number(entry.attendance_rate).toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

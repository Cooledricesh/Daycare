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
import { sortBy } from 'es-toolkit';
import type { CoordinatorPerformanceEntry } from '../lib/dto';

interface CoordinatorPerformanceTableProps {
  coordinatorPerformance: CoordinatorPerformanceEntry[];
}

export function CoordinatorPerformanceTable({ coordinatorPerformance }: CoordinatorPerformanceTableProps) {
  const sorted = sortBy(coordinatorPerformance, [(c) => c.coordinator_name]);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">코디별 성과</CardTitle>
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
        <CardTitle className="text-base">코디별 성과</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>코디네이터</TableHead>
              <TableHead className="text-right">담당 환자</TableHead>
              <TableHead className="text-right">평균 출석률</TableHead>
              <TableHead className="text-right">진찰 참석률</TableHead>
              <TableHead className="text-right">연속 3일+ 결석</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((entry) => (
              <TableRow key={entry.coordinator_id}>
                <TableCell className="font-medium">{entry.coordinator_name}</TableCell>
                <TableCell className="text-right">{entry.assigned_patient_count}명</TableCell>
                <TableCell className="text-right">{Number(entry.avg_attendance_rate).toFixed(1)}%</TableCell>
                <TableCell className="text-right">{Number(entry.consultation_attendance_rate).toFixed(1)}%</TableCell>
                <TableCell className="text-right">{entry.consecutive_absence_patient_count}명</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

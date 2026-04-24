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
import { Badge } from '@/components/ui/badge';
import type { RiskPatientEntry } from '../lib/dto';
import { RISK_CONSECUTIVE_ABSENCE_DAYS, RISK_ATTENDANCE_RATE_THRESHOLD } from '../constants/thresholds';

interface RiskPatientsTableProps {
  riskPatients: RiskPatientEntry[];
}

export function RiskPatientsTable({ riskPatients }: RiskPatientsTableProps) {
  if (riskPatients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">집중 관리 대상</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">집중 관리 대상 환자 없음</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          집중 관리 대상
          <span className="ml-2 text-sm font-normal text-gray-500">
            (출석률 &lt;{RISK_ATTENDANCE_RATE_THRESHOLD}% 또는 연속 결석 {RISK_CONSECUTIVE_ABSENCE_DAYS}일+)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead className="text-right">출석일수</TableHead>
              <TableHead className="text-right">출석률</TableHead>
              <TableHead className="text-right">최장 연속 결석</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {riskPatients.map((entry) => (
              <TableRow key={entry.patient_id}>
                <TableCell className="font-medium">{entry.name}</TableCell>
                <TableCell className="text-right">{entry.attendance_days}일</TableCell>
                <TableCell className="text-right">
                  <span className={Number(entry.attendance_rate) < RISK_ATTENDANCE_RATE_THRESHOLD ? 'text-red-500 font-medium' : ''}>
                    {Number(entry.attendance_rate).toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {entry.longest_consecutive_absence >= RISK_CONSECUTIVE_ABSENCE_DAYS ? (
                    <Badge variant="destructive">{entry.longest_consecutive_absence}일</Badge>
                  ) : (
                    <span>{entry.longest_consecutive_absence}일</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

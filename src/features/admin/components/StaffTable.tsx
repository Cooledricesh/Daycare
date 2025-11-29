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
import { Edit, KeyRound } from 'lucide-react';
import type { StaffPublic } from '../backend/schema';

interface StaffTableProps {
  staff: StaffPublic[];
  onEdit: (staff: StaffPublic) => void;
  onResetPassword: (staff: StaffPublic) => void;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  doctor: { label: '의사', color: 'bg-blue-100 text-blue-700' },
  coordinator: { label: '코디', color: 'bg-green-100 text-green-700' },
  nurse: { label: '간호사', color: 'bg-orange-100 text-orange-700' },
  admin: { label: '관리자', color: 'bg-red-100 text-red-700' },
};

export function StaffTable({ staff, onEdit, onResetPassword }: StaffTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>로그인 ID</TableHead>
            <TableHead>역할</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="w-[150px]">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                직원이 없습니다
              </TableCell>
            </TableRow>
          ) : (
            staff.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell className="font-mono text-sm">{member.login_id}</TableCell>
                <TableCell>
                  <Badge className={roleLabels[member.role].color}>
                    {roleLabels[member.role].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={member.is_active ? 'default' : 'secondary'}>
                    {member.is_active ? '활성' : '비활성'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(member)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onResetPassword(member)}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

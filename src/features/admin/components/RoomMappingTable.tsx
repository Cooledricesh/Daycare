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
import { Edit, Trash2 } from 'lucide-react';
import type { RoomMappingItem } from '../backend/schema';

interface RoomMappingTableProps {
  mappings: RoomMappingItem[];
  onEdit: (mapping: RoomMappingItem) => void;
  onDelete: (mapping: RoomMappingItem) => void;
}

const ROLE_LABELS: Record<'primary' | 'backup' | 'co', string> = {
  primary: '주',
  backup: '백업',
  co: '공동',
};

const ROLE_VARIANT: Record<'primary' | 'backup' | 'co', 'default' | 'secondary' | 'outline'> = {
  primary: 'default',
  backup: 'secondary',
  co: 'outline',
};

export function RoomMappingTable({
  mappings,
  onEdit,
  onDelete,
}: RoomMappingTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>호실</TableHead>
            <TableHead>담당 코디네이터</TableHead>
            <TableHead>설명</TableHead>
            <TableHead className="text-center">환자 수</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="w-[100px]">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                매핑된 호실이 없습니다
              </TableCell>
            </TableRow>
          ) : (
            mappings.map((mapping) => (
              <TableRow key={mapping.id}>
                <TableCell className="font-medium font-mono">
                  {mapping.room_prefix}
                </TableCell>
                <TableCell>
                  {mapping.assignments.length === 0 ? (
                    <span className="text-gray-400">미지정</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {mapping.assignments.map((a) => (
                        <Badge
                          key={a.id}
                          variant={ROLE_VARIANT[a.role]}
                          className="font-normal"
                        >
                          {a.coordinator_name ?? '알 수 없음'}
                          <span className="ml-1 text-[10px] opacity-70">
                            {ROLE_LABELS[a.role]}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-gray-600">
                  {mapping.description || '-'}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{mapping.patient_count}명</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={mapping.is_active ? 'default' : 'secondary'}>
                    {mapping.is_active ? '활성' : '비활성'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(mapping)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(mapping)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
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

'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TaskItem } from '../backend/schema';
import Link from 'next/link';

interface TasksTableProps {
  tasks: TaskItem[];
}

function getTaskTargetLabel(target: 'coordinator' | 'nurse' | 'both'): string {
  switch (target) {
    case 'coordinator':
      return '코디';
    case 'nurse':
      return '간호사';
    case 'both':
      return '코디+간호사';
    default:
      return target;
  }
}

function getCompletionStatus(task: TaskItem): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (task.task_target === 'coordinator') {
    return task.coordinator_completed
      ? { label: '완료', variant: 'default' }
      : { label: '미처리', variant: 'destructive' };
  }

  if (task.task_target === 'nurse') {
    return task.nurse_completed
      ? { label: '완료', variant: 'default' }
      : { label: '미처리', variant: 'destructive' };
  }

  // both
  const coordDone = task.coordinator_completed;
  const nurseDone = task.nurse_completed;

  if (coordDone && nurseDone) {
    return { label: '완료', variant: 'default' };
  }
  if (!coordDone && !nurseDone) {
    return { label: '미처리', variant: 'destructive' };
  }
  return {
    label: `부분 (${coordDone ? '코디✓' : '코디✗'} / ${nurseDone ? '간호✓' : '간호✗'})`,
    variant: 'secondary',
  };
}

export function TasksTable({ tasks }: TasksTableProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        오늘 지시사항이 없습니다.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">호실</TableHead>
          <TableHead className="w-[120px]">환자명</TableHead>
          <TableHead className="w-[100px]">담당코디</TableHead>
          <TableHead>지시내용</TableHead>
          <TableHead className="w-[100px]">대상</TableHead>
          <TableHead className="w-[120px]">처리상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const status = getCompletionStatus(task);
          return (
            <TableRow key={task.consultation_id}>
              <TableCell>{task.room_number || '-'}</TableCell>
              <TableCell>
                <Link
                  href={`/doctor/history/${task.patient_id}`}
                  className="text-blue-600 hover:underline"
                >
                  {task.patient_name}
                </Link>
              </TableCell>
              <TableCell>{task.coordinator_name || '-'}</TableCell>
              <TableCell className="max-w-[300px] truncate">
                {task.task_content}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {getTaskTargetLabel(task.task_target)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={status.variant}>{status.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

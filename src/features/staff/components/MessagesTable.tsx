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
import type { MessageItem } from '../backend/schema';

interface MessagesTableProps {
  messages: MessageItem[];
}

function formatTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function MessagesTable({ messages }: MessagesTableProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        오늘 작성한 전달사항이 없습니다.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">환자명</TableHead>
          <TableHead>전달내용</TableHead>
          <TableHead className="w-[80px]">작성시간</TableHead>
          <TableHead className="w-[80px]">확인여부</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messages.map((message) => (
          <TableRow key={message.id}>
            <TableCell className="font-medium">{message.patient_name}</TableCell>
            <TableCell className="max-w-[300px] truncate">{message.content}</TableCell>
            <TableCell>{formatTime(message.created_at)}</TableCell>
            <TableCell>
              <Badge variant={message.is_read ? 'default' : 'secondary'}>
                {message.is_read ? '확인됨' : '미확인'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

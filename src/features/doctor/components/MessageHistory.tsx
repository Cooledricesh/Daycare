'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MessageRecord } from '../backend/schema';

interface MessageHistoryProps {
  messages: MessageRecord[];
}

function formatDateTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function MessageHistory({ messages }: MessageHistoryProps) {
  if (messages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>전달사항</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">전달사항이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>전달사항 ({messages.length}건)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-3 rounded border ${message.is_read ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{message.author_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {message.author_role === 'coordinator' ? '코디' : '간호사'}
                  </Badge>
                </div>
                <span className="text-xs text-gray-500">{formatDateTime(message.created_at)}</span>
              </div>
              <p className="text-sm">{message.content}</p>
              {!message.is_read && (
                <Badge variant="destructive" className="text-xs mt-2">미확인</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMessages } from '@/features/staff/hooks/useMessages';
import { MessagesTable } from '@/features/staff/components/MessagesTable';
import { CreateMessageForm } from '@/features/staff/components/CreateMessageForm';
import { getTodayString } from '@/lib/date';

export default function StaffMessagesPage() {
  const today = getTodayString();
  const { data: messages, isLoading, error, refetch } = useMessages({ date: today });

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">전달사항 작성</h1>
        <Button variant="outline" onClick={() => refetch()}>
          새로고침
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 전달사항 작성 폼 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>새 전달사항</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateMessageForm onSuccess={() => refetch()} />
          </CardContent>
        </Card>

        {/* 오늘 작성한 전달사항 목록 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>오늘 작성한 전달사항 ({today})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">로딩 중...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                오류가 발생했습니다. 다시 시도해주세요.
              </div>
            ) : (
              <MessagesTable messages={messages || []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

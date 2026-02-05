'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTasks } from '@/features/doctor/hooks/useTasks';
import { TasksTable } from '@/features/doctor/components/TasksTable';
import { getTodayString } from '@/lib/date';

export default function DoctorTasksPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const today = getTodayString();

  const { data: tasks, isLoading, error, refetch } = useTasks({
    date: today,
    status: statusFilter,
  });

  const pendingCount = tasks?.filter((t) => {
    if (t.task_target === 'coordinator') return !t.coordinator_completed;
    if (t.task_target === 'nurse') return !t.nurse_completed;
    return !t.coordinator_completed || !t.nurse_completed;
  }).length || 0;

  const completedCount = tasks?.filter((t) => {
    if (t.task_target === 'coordinator') return t.coordinator_completed;
    if (t.task_target === 'nurse') return t.nurse_completed;
    return t.coordinator_completed && t.nurse_completed;
  }).length || 0;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">처리 필요 항목</h1>
        <Button variant="outline" onClick={() => refetch()}>
          새로고침
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">전체</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks?.length || 0}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">미처리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{pendingCount}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">처리완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}건</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>오늘의 지시사항 ({today})</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as 'all' | 'pending' | 'completed')}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="all">전체</TabsTrigger>
              <TabsTrigger value="pending">미처리</TabsTrigger>
              <TabsTrigger value="completed">처리완료</TabsTrigger>
            </TabsList>

            {isLoading ? (
              <div className="text-center py-8">로딩 중...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                오류가 발생했습니다. 다시 시도해주세요.
              </div>
            ) : (
              <>
                <TabsContent value="all">
                  <TasksTable tasks={tasks || []} />
                </TabsContent>
                <TabsContent value="pending">
                  <TasksTable tasks={tasks || []} />
                </TabsContent>
                <TabsContent value="completed">
                  <TasksTable tasks={tasks || []} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

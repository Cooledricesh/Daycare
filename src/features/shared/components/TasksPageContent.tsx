'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTasks } from '@/features/doctor/hooks/useTasks';
import { useDoctorMessages, useMarkMessageRead } from '@/features/doctor/hooks/useDoctorMessages';
import { TasksTable } from '@/features/doctor/components/TasksTable';
import { MessagesTable } from '@/features/doctor/components/MessagesTable';
import { useToast } from '@/hooks/use-toast';

type TypeFilter = 'all' | 'tasks' | 'messages';
type TaskStatusFilter = 'all' | 'pending' | 'completed';
type MessageStatusFilter = 'all' | 'unread' | 'read';

interface TasksPageContentProps {
  patientLinkPrefix?: string;
}

export function TasksPageContent({ patientLinkPrefix = '/dashboard/doctor/history' }: TasksPageContentProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [taskStatus, setTaskStatus] = useState<TaskStatusFilter>('all');
  const [messageStatus, setMessageStatus] = useState<MessageStatusFilter>('all');
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const { toast } = useToast();

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useTasks({
    startDate: startDateStr,
    endDate: endDateStr,
    status: taskStatus,
  });

  const { data: messages, isLoading: messagesLoading, refetch: refetchMessages } = useDoctorMessages({
    startDate: startDateStr,
    endDate: endDateStr,
    isRead: messageStatus,
  });

  const markRead = useMarkMessageRead();

  const handleMarkRead = (messageId: string) => {
    markRead.mutate(messageId, {
      onSuccess: () => {
        toast({ title: '확인 완료', description: '전달사항을 확인 처리했습니다.' });
      },
      onError: () => {
        toast({ title: '오류', description: '확인 처리에 실패했습니다.', variant: 'destructive' });
      },
    });
  };

  const handleRefresh = () => {
    refetchTasks();
    refetchMessages();
  };

  const pendingTaskCount = tasks?.filter((t) =>
    !t.coordinator_completed && !t.nurse_completed
  ).length || 0;

  const unreadMessageCount = messages?.filter((m) => !m.is_read).length || 0;

  const handleTypeChange = (v: string) => {
    setTypeFilter(v as TypeFilter);
    setTaskStatus('all');
    setMessageStatus('all');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">처리 필요 항목</h1>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, 'MM/dd', { locale: ko })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
              />
            </PopoverContent>
          </Popover>
          <span className="text-gray-500">~</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(endDate, 'MM/dd', { locale: ko })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={handleRefresh}>
            새로고침
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">지시사항</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks?.length || 0}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">지시 미처리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{pendingTaskCount}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">전달사항</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messages?.length || 0}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">미확인 전달</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{unreadMessageCount}건</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={typeFilter} onValueChange={handleTypeChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="tasks">지시사항</TabsTrigger>
          <TabsTrigger value="messages">전달사항</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">지시사항</CardTitle>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  <div className="text-center py-8">로딩 중...</div>
                ) : (
                  <TasksTable tasks={tasks || []} patientLinkPrefix={patientLinkPrefix} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">전달사항</CardTitle>
              </CardHeader>
              <CardContent>
                {messagesLoading ? (
                  <div className="text-center py-8">로딩 중...</div>
                ) : (
                  <MessagesTable
                    messages={messages || []}
                    onMarkRead={handleMarkRead}
                    isMarkingRead={markRead.isPending}
                    patientLinkPrefix={patientLinkPrefix}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">지시사항</CardTitle>
                <Tabs value={taskStatus} onValueChange={(v) => setTaskStatus(v as TaskStatusFilter)}>
                  <TabsList>
                    <TabsTrigger value="all">전체</TabsTrigger>
                    <TabsTrigger value="pending">미처리</TabsTrigger>
                    <TabsTrigger value="completed">처리완료</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="text-center py-8">로딩 중...</div>
              ) : (
                <TasksTable tasks={tasks || []} patientLinkPrefix={patientLinkPrefix} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">전달사항</CardTitle>
                <Tabs value={messageStatus} onValueChange={(v) => setMessageStatus(v as MessageStatusFilter)}>
                  <TabsList>
                    <TabsTrigger value="all">전체</TabsTrigger>
                    <TabsTrigger value="unread">미확인</TabsTrigger>
                    <TabsTrigger value="read">확인완료</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="text-center py-8">로딩 중...</div>
              ) : (
                <MessagesTable
                  messages={messages || []}
                  onMarkRead={handleMarkRead}
                  isMarkingRead={markRead.isPending}
                  patientLinkPrefix={patientLinkPrefix}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

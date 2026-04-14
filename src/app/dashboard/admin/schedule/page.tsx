'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Edit, Search, X, Calendar as CalendarIcon, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useScheduleStore } from '@/features/admin/stores/useScheduleStore';
import {
  useSchedulePatterns,
  useDailySchedule,
  useCancelSchedule,
  useDeleteSchedule,
  useGenerateSchedule,
} from '@/features/admin/hooks/useSchedule';
import { SchedulePatternModal } from '@/features/admin/components/SchedulePatternModal';
import { ManualScheduleModal } from '@/features/admin/components/ManualScheduleModal';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from 'react-use';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

export default function SchedulePage() {
  const {
    activeTab,
    patternsSearch,
    patternsPage,
    selectedDate,
    dailyFilters,
    setActiveTab,
    setPatternsSearch,
    setPatternsPage,
    openPatternModal,
    setSelectedDate,
    setDailyFilters,
    openManualAddModal,
  } = useScheduleStore();

  const [debouncedSearch, setDebouncedSearch] = useState(patternsSearch);

  useDebounce(() => {
    setPatternsSearch(debouncedSearch);
  }, 500, [debouncedSearch]);

  // 기본 패턴 탭
  const { data: patternsData, isLoading: patternsLoading } = useSchedulePatterns({
    page: patternsPage,
    limit: 20,
    search: patternsSearch || undefined,
  });

  const patterns = patternsData?.data || [];
  const patternsTotal = patternsData?.total || 0;
  const patternsTotalPages = Math.ceil(patternsTotal / 20);

  // 일일 스케줄 탭
  const { data: dailyData, isLoading: dailyLoading } = useDailySchedule({
    date: selectedDate,
    source: dailyFilters.source !== 'all' ? dailyFilters.source : undefined,
    status: dailyFilters.status !== 'all' ? dailyFilters.status : undefined,
  });

  const dailySchedules = dailyData?.data || [];
  const dailyStats = dailyData?.stats || {
    total: 0,
    auto: 0,
    manual: 0,
    cancelled: 0,
  };

  const cancelSchedule = useCancelSchedule();
  const deleteSchedule = useDeleteSchedule();
  const generateSchedule = useGenerateSchedule();
  const { toast } = useToast();

  const handleGenerateSchedule = async () => {
    try {
      const result = await generateSchedule.mutateAsync(selectedDate);
      toast({
        title: '스케줄 생성 완료',
        description: `${result.generated}명 생성, ${result.skipped}명 기존`,
      });
    } catch (error: any) {
      toast({
        title: '스케줄 생성 실패',
        description: error.response?.data?.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelToggle = async (id: string, currentlyCancelled: boolean) => {
    try {
      await cancelSchedule.mutateAsync({
        id,
        data: { is_cancelled: !currentlyCancelled },
      });
    } catch (error) {
      console.error('Failed to toggle cancellation:', error);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deleteSchedule.mutateAsync(id);
    } catch (error: any) {
      alert(error.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">스케줄 관리</h1>
        <p className="text-sm text-gray-600 mt-1">
          기본 출석 패턴 및 일일 예정 관리
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="patterns">기본 스케줄</TabsTrigger>
          <TabsTrigger value="daily">일일 예정</TabsTrigger>
        </TabsList>

        {/* Tab 1: 기본 스케줄 패턴 */}
        <TabsContent value="patterns" className="space-y-4">
          {/* Search */}
          <div className="bg-white rounded-lg border p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="환자 이름 검색..."
                value={debouncedSearch}
                onChange={(e) => setDebouncedSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          {patternsLoading ? (
            <div className="text-center py-12 text-gray-500">
              불러오는 중...
            </div>
          ) : (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>환자명</TableHead>
                      <TableHead>담당 코디</TableHead>
                      <TableHead>출석 패턴</TableHead>
                      <TableHead className="w-[100px]">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patterns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                          환자가 없습니다
                        </TableCell>
                      </TableRow>
                    ) : (
                      patterns.map((pattern) => (
                        <TableRow key={pattern.patient_id}>
                          <TableCell className="font-medium">
                            {pattern.patient_name}
                          </TableCell>
                          <TableCell>{pattern.coordinator_name || '-'}</TableCell>
                          <TableCell>
                            {pattern.schedule_days.length > 0 ? (
                              <div className="flex gap-1">
                                {pattern.schedule_days.map((day) => (
                                  <Badge key={day} variant="outline" className="text-xs">
                                    {dayNames[day]}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">미설정</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPatternModal(pattern.patient_id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {patternsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPatternsPage(patternsPage - 1)}
                    disabled={patternsPage === 1}
                  >
                    이전
                  </Button>
                  <span className="text-sm text-gray-600">
                    {patternsPage} / {patternsTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPatternsPage(patternsPage + 1)}
                    disabled={patternsPage === patternsTotalPages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Tab 2: 일일 예정 */}
        <TabsContent value="daily" className="space-y-4">
          {/* Date Picker & Filters */}
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-4">
              {/* Date Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(selectedDate), 'PPP', { locale: ko })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(selectedDate)}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(format(date, 'yyyy-MM-dd'));
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
              >
                오늘
              </Button>

              <Button
                variant="outline"
                onClick={handleGenerateSchedule}
                disabled={generateSchedule.isPending}
              >
                {generateSchedule.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                스케줄 생성
              </Button>

              <div className="ml-auto">
                <Button onClick={openManualAddModal}>
                  <Plus className="mr-2 h-4 w-4" />
                  수동 추가
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                value={dailyFilters.source}
                onValueChange={(v: any) => setDailyFilters({ source: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 소스</SelectItem>
                  <SelectItem value="auto">자동 생성</SelectItem>
                  <SelectItem value="manual">수동 추가</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={dailyFilters.status}
                onValueChange={(v: any) => setDailyFilters({ status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="active">예정</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-600">전체</div>
              <div className="text-2xl font-bold">{dailyStats.total}</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-600">자동 생성</div>
              <div className="text-2xl font-bold">{dailyStats.auto}</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-600">수동 추가</div>
              <div className="text-2xl font-bold">{dailyStats.manual}</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-sm text-gray-600">취소</div>
              <div className="text-2xl font-bold">{dailyStats.cancelled}</div>
            </div>
          </div>

          {/* Table */}
          {dailyLoading ? (
            <div className="text-center py-12 text-gray-500">
              불러오는 중...
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>환자명</TableHead>
                    <TableHead>담당 코디</TableHead>
                    <TableHead>소스</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-[150px]">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySchedules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        예정된 출석이 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailySchedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">
                          {schedule.patient_name}
                        </TableCell>
                        <TableCell>{schedule.coordinator_name || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={schedule.source === 'auto' ? 'default' : 'secondary'}
                          >
                            {schedule.source === 'auto' ? '자동' : '수동'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={schedule.is_cancelled ? 'destructive' : 'default'}
                          >
                            {schedule.is_cancelled ? '취소' : '예정'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleCancelToggle(schedule.id, schedule.is_cancelled)
                              }
                            >
                              {schedule.is_cancelled ? '복원' : '취소'}
                            </Button>
                            {schedule.source === 'manual' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSchedule(schedule.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SchedulePatternModal />
      <ManualScheduleModal />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2 } from 'lucide-react';
import { format, subDays, max } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStatsSummary, useDailyStats, useBatchRecalculateStats } from '@/features/admin/hooks/useStats';
import { useBatchGenerateSchedules } from '@/features/admin/hooks/useSchedule';
import { HolidayManageDialog } from '@/features/admin/components/HolidayManageDialog';
import { STATS_DATA_START_DATE_OBJ } from '@/features/shared/constants/stats';
import { useToast } from '@/hooks/use-toast';
import { StatsDateRangePicker } from '@/features/shared/components/stats/StatsDateRangePicker';
import { StatsKpiCards } from '@/features/shared/components/stats/StatsKpiCards';
import { RegisteredPatientChart } from '@/features/shared/components/stats/RegisteredPatientChart';
import { AttendanceRateChart } from '@/features/shared/components/stats/AttendanceRateChart';
import { ConsultationRateChart } from '@/features/shared/components/stats/ConsultationRateChart';
import { DayOfWeekChart } from '@/features/shared/components/stats/DayOfWeekChart';
import { StatsDetailTable } from '@/features/shared/components/stats/StatsDetailTable';

export default function StatsPage() {
  const [startDate, setStartDate] = useState<Date>(max([subDays(new Date(), 30), STATS_DATA_START_DATE_OBJ]));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const { data: summary, isLoading: summaryLoading } = useStatsSummary({
    start_date: startDateStr,
    end_date: endDateStr,
  });

  const { data: dailyStats, isLoading: dailyLoading } = useDailyStats({
    start_date: startDateStr,
    end_date: endDateStr,
  });

  const batchGenerateSchedules = useBatchGenerateSchedules();
  const batchRecalculateStats = useBatchRecalculateStats();
  const { toast } = useToast();

  const handleRecalculate = async () => {
    try {
      await batchGenerateSchedules.mutateAsync({
        start_date: startDateStr,
        end_date: endDateStr,
      });
      const result = await batchRecalculateStats.mutateAsync({
        start_date: startDateStr,
        end_date: endDateStr,
      });
      toast({
        title: '통계 재계산 완료',
        description: `${result.processed}일 처리됨`,
      });
    } catch (error: any) {
      toast({
        title: '통계 재계산 실패',
        description: error.response?.data?.message || '다시 시도해주세요.',
        variant: 'destructive',
      });
    }
  };

  const isRecalculating = batchGenerateSchedules.isPending || batchRecalculateStats.isPending;
  const isLoading = summaryLoading || dailyLoading;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">통계</h1>
          <p className="text-sm text-gray-600 mt-1">
            출석률 및 진찰 참석률 통계
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatsDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          <HolidayManageDialog />
          <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={isRecalculating}
          >
            {isRecalculating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="mr-2 h-4 w-4" />
            )}
            통계 재계산
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      ) : (
        <>
          {/* KPI Cards */}
          {summary && <StatsKpiCards summary={summary} />}

          {/* Tabs */}
          <Tabs defaultValue="trend" className="space-y-4">
            <TabsList>
              <TabsTrigger value="trend">추이</TabsTrigger>
              <TabsTrigger value="day-of-week">요일별</TabsTrigger>
            </TabsList>

            <TabsContent value="trend" className="space-y-4">
              {dailyStats && <RegisteredPatientChart dailyStats={dailyStats} />}
              {dailyStats && <AttendanceRateChart dailyStats={dailyStats} />}
              {dailyStats && <ConsultationRateChart dailyStats={dailyStats} />}
            </TabsContent>

            <TabsContent value="day-of-week">
              <DayOfWeekChart
                dailyStats={dailyStats || []}
                isLoading={dailyLoading}
              />
            </TabsContent>
          </Tabs>

          {/* Detail Table */}
          {dailyStats && <StatsDetailTable dailyStats={dailyStats} />}
        </>
      )}
    </div>
  );
}

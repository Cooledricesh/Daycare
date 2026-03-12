'use client';

import { useState } from 'react';
import { format, subDays, max } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useSharedStatsSummary,
  useSharedDailyStats,
  useSharedDayOfWeekStats,
} from '@/features/shared/hooks/useSharedStats';
import { StatsDateRangePicker } from '@/features/shared/components/stats/StatsDateRangePicker';
import { StatsKpiCards } from '@/features/shared/components/stats/StatsKpiCards';
import { RegisteredPatientChart } from '@/features/shared/components/stats/RegisteredPatientChart';
import { AttendanceRateChart } from '@/features/shared/components/stats/AttendanceRateChart';
import { ConsultationRateChart } from '@/features/shared/components/stats/ConsultationRateChart';
import { DayOfWeekChart } from '@/features/shared/components/stats/DayOfWeekChart';
import { StatsDetailTable } from '@/features/shared/components/stats/StatsDetailTable';
import { STATS_DATA_START_DATE } from '@/features/shared/constants/stats';

export default function SharedStatsPage() {
  const minDate = new Date(STATS_DATA_START_DATE + 'T00:00:00');
  const [startDate, setStartDate] = useState<Date>(max([subDays(new Date(), 30), minDate]));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const { data: summary, isLoading: summaryLoading } = useSharedStatsSummary({
    start_date: startDateStr,
    end_date: endDateStr,
  });

  const { data: dailyStats, isLoading: dailyLoading } = useSharedDailyStats({
    start_date: startDateStr,
    end_date: endDateStr,
  });

  const { data: dayOfWeekStats, isLoading: dowLoading } = useSharedDayOfWeekStats({
    start_date: startDateStr,
    end_date: endDateStr,
  });

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
        <StatsDateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
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
                data={dayOfWeekStats || []}
                isLoading={dowLoading}
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

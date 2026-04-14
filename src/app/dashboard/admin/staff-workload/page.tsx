'use client';

import { useState } from 'react';
import { format, subDays, max } from 'date-fns';
import { StatsDateRangePicker } from '@/features/shared/components/stats/StatsDateRangePicker';
import { STATS_DATA_START_DATE_OBJ } from '@/features/shared/constants/stats';
import { useCoordinatorWorkload } from '@/features/admin/hooks/useCoordinatorWorkload';
import { WorkloadSummaryCards } from '@/features/admin/components/WorkloadSummaryCards';
import { CoordinatorWorkloadTable } from '@/features/admin/components/CoordinatorWorkloadTable';
import { WorkloadComparisonChart } from '@/features/admin/components/WorkloadComparisonChart';
import { useHydrated } from '@/hooks/useHydrated';

const DEFAULT_PERIOD_DAYS = 30;

function getInitialDates() {
  const now = new Date();
  return {
    start: max([subDays(now, DEFAULT_PERIOD_DAYS), STATS_DATA_START_DATE_OBJ]),
    end: now,
  };
}

const PAGE_HEADER = (
  <div>
    <h1 className="text-2xl font-bold text-gray-900">직원 워크로드</h1>
    <p className="text-sm text-gray-600 mt-1">
      코디네이터별 실질 업무량(출석 기반) 비교
    </p>
  </div>
);

export default function StaffWorkloadPage() {
  const hydrated = useHydrated();
  const [{ start: startDate, end: endDate }, setDates] = useState(getInitialDates);

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const { data: workload, isLoading, isError } = useCoordinatorWorkload({
    start_date: startDateStr,
    end_date: endDateStr,
    enabled: hydrated,
  });

  if (!hydrated) {
    return (
      <div className="p-8 space-y-6">
        {PAGE_HEADER}
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {PAGE_HEADER}
        <StatsDateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(date) => setDates((prev) => ({ ...prev, start: date }))}
          onEndDateChange={(date) => setDates((prev) => ({ ...prev, end: date }))}
        />
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      )}

      {isError && (
        <div className="text-center py-12 text-red-500">
          데이터를 불러오는 데 실패했습니다. 다시 시도해주세요.
        </div>
      )}

      {workload && (
        <>
          <WorkloadSummaryCards summary={workload} />

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-800">
              코디네이터별 워크로드
            </h2>
            <CoordinatorWorkloadTable
              coordinators={workload.coordinators}
              perCoordinatorAvg={workload.per_coordinator_avg}
            />
          </div>

          <WorkloadComparisonChart coordinators={workload.coordinators} />
        </>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { format, subDays, max } from 'date-fns';
import { StatsDateRangePicker } from '@/features/shared/components/stats/StatsDateRangePicker';
import { STATS_DATA_START_DATE_OBJ } from '@/features/shared/constants/stats';
import { useCoordinatorWorkload } from '@/features/admin/hooks/useCoordinatorWorkload';
import { WorkloadSummaryCards } from '@/features/admin/components/WorkloadSummaryCards';
import { CoordinatorWorkloadTable } from '@/features/admin/components/CoordinatorWorkloadTable';
import { WorkloadComparisonChart } from '@/features/admin/components/WorkloadComparisonChart';

const DEFAULT_PERIOD_DAYS = 30;

export default function StaffWorkloadPage() {
  const [startDate, setStartDate] = useState<Date>(
    max([subDays(new Date(), DEFAULT_PERIOD_DAYS), STATS_DATA_START_DATE_OBJ]),
  );
  const [endDate, setEndDate] = useState<Date>(new Date());

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const { data: workload, isLoading, isError } = useCoordinatorWorkload({
    start_date: startDateStr,
    end_date: endDateStr,
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">직원 워크로드</h1>
          <p className="text-sm text-gray-600 mt-1">
            코디네이터별 실질 업무량(출석 기반) 비교
          </p>
        </div>
        <StatsDateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
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

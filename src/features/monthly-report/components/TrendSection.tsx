'use client';

import type { MonthlyReportResponse } from '../lib/dto';
import { WeeklyTrendChart } from './WeeklyTrendChart';
import { WeekdayAvgBarChart } from './WeekdayAvgBarChart';
import { PrevMonthComparisonTable } from './PrevMonthComparisonTable';

interface TrendSectionProps {
  report: MonthlyReportResponse;
}

export function TrendSection({ report }: TrendSectionProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">추이 분석</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeeklyTrendChart weeklyTrend={report.weekly_trend} />
        <WeekdayAvgBarChart weekdayAvg={report.weekday_avg} />
      </div>
      <PrevMonthComparisonTable report={report} />
    </div>
  );
}

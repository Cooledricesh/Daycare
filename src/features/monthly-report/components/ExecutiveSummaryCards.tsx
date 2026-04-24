'use client';

import type { MonthlyReportResponse } from '../lib/dto';
import { TotalAttendanceDaysCard } from './TotalAttendanceDaysCard';
import { PerPatientAvgDaysCard } from './PerPatientAvgDaysCard';
import { DailyAvgAttendanceCard } from './DailyAvgAttendanceCard';
import { ConsultationRateCard } from './ConsultationRateCard';
import { RegisteredCountCard } from './RegisteredCountCard';

interface ExecutiveSummaryCardsProps {
  report: MonthlyReportResponse;
}

export function ExecutiveSummaryCards({ report }: ExecutiveSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      <TotalAttendanceDaysCard report={report} />
      <PerPatientAvgDaysCard report={report} />
      <DailyAvgAttendanceCard report={report} />
      <ConsultationRateCard report={report} />
      <RegisteredCountCard report={report} />
    </div>
  );
}

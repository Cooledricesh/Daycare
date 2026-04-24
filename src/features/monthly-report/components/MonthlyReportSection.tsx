'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { useMonthlyReport } from '../hooks/useMonthlyReport';
import { ReportHeader } from './ReportHeader';
import { ExecutiveSummaryCards } from './ExecutiveSummaryCards';
import { TrendSection } from './TrendSection';
import { CoordinatorPerformanceTable } from './CoordinatorPerformanceTable';
import { PatientSegmentsSection } from './PatientSegmentsSection';
import { ConsultationStatsSection } from './ConsultationStatsSection';
import { SpecialNotesSection } from './SpecialNotesSection';
import { ActionItemsEditor } from './ActionItemsEditor';

interface MonthlyReportSectionProps {
  year: number;
  month: number;
}

export function MonthlyReportSection({ year, month }: MonthlyReportSectionProps) {
  const { data: report, isLoading, isError, error } = useMonthlyReport(year, month);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-500">리포트 생성 중...</span>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="flex items-center justify-center py-24 text-red-500">
        <AlertCircle className="h-6 w-6 mr-2" />
        <span>
          리포트를 불러오는데 실패했습니다.{' '}
          {error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.'}
        </span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <ReportHeader
        year={report.year}
        month={report.month}
        generatedAt={report.generated_at}
        generatedBy={report.generated_by}
      />

      <ExecutiveSummaryCards report={report} />

      <TrendSection report={report} />

      <CoordinatorPerformanceTable coordinatorPerformance={report.coordinator_performance} />

      <PatientSegmentsSection patientSegments={report.patient_segments} />

      <ConsultationStatsSection consultationStats={report.consultation_stats} />

      <SpecialNotesSection specialNotes={report.special_notes} />

      <ActionItemsEditor year={year} month={month} initialValue={report.action_items} />
    </div>
  );
}

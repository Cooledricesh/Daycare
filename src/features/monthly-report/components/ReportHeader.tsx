'use client';

import { MonthSelector } from './MonthSelector';
import { RegenerateButton } from './RegenerateButton';
import { GeneratedAtBadge } from './GeneratedAtBadge';

interface ReportHeaderProps {
  year: number;
  month: number;
  generatedAt: string;
  generatedBy: 'cron' | 'manual';
}

export function ReportHeader({ year, month, generatedAt, generatedBy }: ReportHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">월간 리포트</h1>
        <p className="text-sm text-gray-600 mt-1">
          {year}년 {month}월 출석 및 진찰 성과
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <GeneratedAtBadge generatedAt={generatedAt} generatedBy={generatedBy} />
        <MonthSelector year={year} month={month} />
        <RegenerateButton year={year} month={month} />
      </div>
    </div>
  );
}

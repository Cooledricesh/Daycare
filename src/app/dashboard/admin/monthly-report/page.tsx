'use client';

import { use } from 'react';
import { subMonths } from 'date-fns';
import { MonthlyReportSection } from '@/features/monthly-report/components/MonthlyReportSection';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getPrevMonthKST(): { year: number; month: number } {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const prevMonth = subMonths(nowKst, 1);
  return {
    year: prevMonth.getUTCFullYear(),
    month: prevMonth.getUTCMonth() + 1,
  };
}

interface PageProps {
  params: Promise<Record<string, never>>;
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default function MonthlyReportPage({ params: _params, searchParams }: PageProps) {
  const resolvedSearchParams = use(searchParams);

  const defaultPeriod = getPrevMonthKST();

  const year = resolvedSearchParams.year
    ? parseInt(resolvedSearchParams.year, 10)
    : defaultPeriod.year;

  const month = resolvedSearchParams.month
    ? parseInt(resolvedSearchParams.month, 10)
    : defaultPeriod.month;

  const validYear = Number.isFinite(year) ? year : defaultPeriod.year;
  const validMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : defaultPeriod.month;

  return <MonthlyReportSection year={validYear} month={validMonth} />;
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { MonthlyReportResponse } from '../lib/dto';

export const monthlyReportKeys = {
  all: ['monthly-report'] as const,
  list: () => ['monthly-report', 'list'] as const,
  detail: (year: number, month: number) => ['monthly-report', year, month] as const,
};

export function useMonthlyReport(year: number, month: number) {
  return useQuery({
    queryKey: monthlyReportKeys.detail(year, month),
    queryFn: async (): Promise<MonthlyReportResponse> => {
      const response = await apiClient.get<MonthlyReportResponse>(
        `/api/admin/monthly-reports/${year}/${month}`,
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

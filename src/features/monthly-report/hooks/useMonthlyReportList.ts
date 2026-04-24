'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { monthlyReportKeys } from './useMonthlyReport';
import type { MonthlyReportListItem } from '../lib/dto';

export function useMonthlyReportList() {
  return useQuery({
    queryKey: monthlyReportKeys.list(),
    queryFn: async (): Promise<MonthlyReportListItem[]> => {
      const response = await apiClient.get<MonthlyReportListItem[]>(
        '/api/admin/monthly-reports',
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { monthlyReportKeys } from './useMonthlyReport';
import type { MonthlyReportResponse } from '../lib/dto';

type RegenerateParams = {
  year: number;
  month: number;
};

export function useRegenerateMonthlyReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, month }: RegenerateParams): Promise<MonthlyReportResponse> => {
      const response = await apiClient.post<MonthlyReportResponse>(
        `/api/admin/monthly-reports/${year}/${month}/regenerate`,
      );
      return response.data;
    },
    onSuccess: (_data, { year, month }) => {
      queryClient.invalidateQueries({ queryKey: monthlyReportKeys.detail(year, month) });
      queryClient.invalidateQueries({ queryKey: monthlyReportKeys.list() });
    },
  });
}

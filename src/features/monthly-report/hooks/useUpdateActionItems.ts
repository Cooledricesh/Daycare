'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { monthlyReportKeys } from './useMonthlyReport';

type UpdateActionItemsParams = {
  year: number;
  month: number;
  action_items: string;
};

type UpdateActionItemsResponse = {
  success: true;
  updated_at: string;
};

export function useUpdateActionItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, month, action_items }: UpdateActionItemsParams): Promise<UpdateActionItemsResponse> => {
      const response = await apiClient.patch<UpdateActionItemsResponse>(
        `/api/admin/monthly-reports/${year}/${month}/action-items`,
        { action_items },
      );
      return response.data;
    },
    onSuccess: (_data, { year, month }) => {
      queryClient.invalidateQueries({ queryKey: monthlyReportKeys.detail(year, month) });
    },
  });
}

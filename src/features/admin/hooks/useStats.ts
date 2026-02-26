'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type {
  GetStatsSummaryQuery,
  GetDailyStatsQuery,
  StatsSummary,
  DailyStatsItem,
  BatchOperationResult,
} from '../backend/schema';

export function useStatsSummary(query: GetStatsSummaryQuery) {
  return useQuery({
    queryKey: ['admin', 'stats-summary', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start_date', query.start_date);
      params.set('end_date', query.end_date);

      const response = await apiClient.get<StatsSummary>(
        `/api/admin/stats/summary?${params.toString()}`
      );
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useDailyStats(query: GetDailyStatsQuery) {
  return useQuery({
    queryKey: ['admin', 'daily-stats', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start_date', query.start_date);
      params.set('end_date', query.end_date);

      const response = await apiClient.get<{ data: DailyStatsItem[] }>(
        `/api/admin/stats/daily?${params.toString()}`
      );
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useBatchRecalculateStats() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { start_date: string; end_date: string }) => {
      const response = await apiClient.post<BatchOperationResult>(
        '/api/admin/stats/recalculate',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats-summary'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'daily-stats'] });
    },
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type {
  GetStatsSummaryQuery,
  GetDailyStatsQuery,
  StatsSummary,
  DailyStatsItem,
} from '@/features/admin/backend/schema';
import { sharedKeys } from './query-keys';

export function useSharedStatsSummary(query: GetStatsSummaryQuery) {
  return useQuery({
    queryKey: sharedKeys.statsSummary.detail(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start_date', query.start_date);
      params.set('end_date', query.end_date);

      const response = await apiClient.get<StatsSummary>(
        `/api/shared/stats/summary?${params.toString()}`
      );
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useSharedDailyStats(query: GetDailyStatsQuery) {
  return useQuery({
    queryKey: sharedKeys.dailyStats.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start_date', query.start_date);
      params.set('end_date', query.end_date);

      const response = await apiClient.get<{ data: DailyStatsItem[] }>(
        `/api/shared/stats/daily?${params.toString()}`
      );
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type {
  GetStatsSummaryQuery,
  GetDailyStatsQuery,
  StatsSummary,
  DailyStatsItem,
  DayOfWeekStatsItem,
  GetHolidaysQuery,
  HolidayItem,
} from '@/features/admin/backend/schema';

export function useSharedStatsSummary(query: GetStatsSummaryQuery) {
  return useQuery({
    queryKey: ['shared', 'stats-summary', query],
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
    queryKey: ['shared', 'daily-stats', query],
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

export function useSharedDayOfWeekStats(query: GetDailyStatsQuery) {
  return useQuery({
    queryKey: ['shared', 'day-of-week-stats', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start_date', query.start_date);
      params.set('end_date', query.end_date);

      const response = await apiClient.get<{ data: DayOfWeekStatsItem[] }>(
        `/api/shared/stats/day-of-week?${params.toString()}`
      );
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useSharedHolidays(query: GetHolidaysQuery) {
  return useQuery({
    queryKey: ['shared', 'holidays', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start_date', query.start_date);
      params.set('end_date', query.end_date);

      const response = await apiClient.get<{ data: HolidayItem[] }>(
        `/api/shared/holidays?${params.toString()}`
      );
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

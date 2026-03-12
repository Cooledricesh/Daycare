'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type {
  GetHolidaysQuery,
  HolidayItem,
  CreateHolidayRequest,
} from '../backend/schema';

function invalidateHolidayRelatedQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'holidays'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'stats-summary'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'daily-stats'] });
  queryClient.invalidateQueries({ queryKey: ['shared', 'stats-summary'] });
  queryClient.invalidateQueries({ queryKey: ['shared', 'daily-stats'] });
  queryClient.invalidateQueries({ queryKey: ['shared', 'day-of-week-stats'] });
}

export function useHolidays(query: GetHolidaysQuery) {
  return useQuery({
    queryKey: ['admin', 'holidays', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start_date', query.start_date);
      params.set('end_date', query.end_date);

      const response = await apiClient.get<{ data: HolidayItem[] }>(
        `/api/admin/holidays?${params.toString()}`
      );
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHolidayRequest) => {
      const response = await apiClient.post<HolidayItem>(
        '/api/admin/holidays',
        data
      );
      return response.data;
    },
    onSuccess: () => invalidateHolidayRelatedQueries(queryClient),
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (holidayId: string) => {
      const response = await apiClient.delete<{ success: boolean }>(
        `/api/admin/holidays/${holidayId}`
      );
      return response.data;
    },
    onSuccess: () => invalidateHolidayRelatedQueries(queryClient),
  });
}

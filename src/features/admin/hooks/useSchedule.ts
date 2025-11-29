'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type {
  GetSchedulePatternsQuery,
  UpdateSchedulePatternRequest,
  GetDailyScheduleQuery,
  AddManualScheduleRequest,
  CancelScheduleRequest,
  SchedulePatternItem,
  DailyScheduleResponse,
  DailyScheduleItem,
} from '../backend/schema';

interface SchedulePatternsResponse {
  data: SchedulePatternItem[];
  total: number;
  page: number;
  limit: number;
}

export function useSchedulePatterns(query: Partial<GetSchedulePatternsQuery>) {
  return useQuery({
    queryKey: ['admin', 'schedule-patterns', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      if (query.search) params.set('search', query.search);

      const response = await apiClient.get<SchedulePatternsResponse>(
        `/api/admin/schedule/patterns?${params.toString()}`
      );
      return response.data;
    },
    staleTime: 3 * 60 * 1000,
  });
}

export function useUpdateSchedulePattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: UpdateSchedulePatternRequest;
    }) => {
      const response = await apiClient.put<{ success: boolean }>(
        `/api/admin/schedule/patterns/${patientId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'schedule-patterns'] });
    },
  });
}

export function useDailySchedule(query: GetDailyScheduleQuery) {
  return useQuery({
    queryKey: ['admin', 'daily-schedule', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('date', query.date);
      if (query.source) params.set('source', query.source);
      if (query.status) params.set('status', query.status);

      const response = await apiClient.get<DailyScheduleResponse>(
        `/api/admin/schedule/daily?${params.toString()}`
      );
      return response.data;
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function useAddManualSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddManualScheduleRequest) => {
      const response = await apiClient.post<DailyScheduleItem>(
        '/api/admin/schedule/daily',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'daily-schedule'] });
    },
  });
}

export function useCancelSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CancelScheduleRequest;
    }) => {
      const response = await apiClient.patch<{ id: string; is_cancelled: boolean }>(
        `/api/admin/schedule/daily/${id}/cancel`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'daily-schedule'] });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ success: boolean }>(
        `/api/admin/schedule/daily/${id}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'daily-schedule'] });
    },
  });
}

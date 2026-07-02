'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { adminKeys } from './query-keys';
import { sharedKeys } from '../../shared/hooks/query-keys';
import type {
  GetClinicClosuresQuery,
  ClinicClosureItem,
  CreateClinicClosureRequest,
} from '../backend/schema';

function invalidateClinicClosureRelatedQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: adminKeys.clinicClosures.all });
  queryClient.invalidateQueries({ queryKey: adminKeys.statsSummary.all });
  queryClient.invalidateQueries({ queryKey: adminKeys.dailyStats.all });
  queryClient.invalidateQueries({ queryKey: sharedKeys.statsSummary.all });
  queryClient.invalidateQueries({ queryKey: sharedKeys.dailyStats.all });
  queryClient.invalidateQueries({ queryKey: sharedKeys.dayOfWeekStats.all });
  // 휴진일은 오늘 하이라이트(examMissed)에도 영향을 주므로 함께 무효화
  queryClient.invalidateQueries({ queryKey: ['highlights', 'today'] });
}

export function useClinicClosures(query: GetClinicClosuresQuery) {
  return useQuery({
    queryKey: adminKeys.clinicClosures.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start_date', query.start_date);
      params.set('end_date', query.end_date);

      const response = await apiClient.get<{ data: ClinicClosureItem[] }>(
        `/api/admin/clinic-closures?${params.toString()}`
      );
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateClinicClosure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateClinicClosureRequest) => {
      const response = await apiClient.post<ClinicClosureItem>(
        '/api/admin/clinic-closures',
        data
      );
      return response.data;
    },
    onSuccess: () => invalidateClinicClosureRelatedQueries(queryClient),
  });
}

export function useDeleteClinicClosure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (closureId: string) => {
      const response = await apiClient.delete<{ success: boolean }>(
        `/api/admin/clinic-closures/${closureId}`
      );
      return response.data;
    },
    onSuccess: () => invalidateClinicClosureRelatedQueries(queryClient),
  });
}

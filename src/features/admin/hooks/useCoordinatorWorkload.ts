'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { adminKeys } from './query-keys';
import type { CoordinatorWorkloadSummary } from '../backend/schema';

interface UseCoordinatorWorkloadParams {
  start_date: string;
  end_date: string;
  enabled?: boolean;
}

export function useCoordinatorWorkload({ enabled = true, ...params }: UseCoordinatorWorkloadParams) {
  return useQuery({
    queryKey: adminKeys.coordinatorWorkload.detail(params),
    enabled,
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        start_date: params.start_date,
        end_date: params.end_date,
      });
      const response = await apiClient.get<CoordinatorWorkloadSummary>(
        `/api/admin/coordinator-workload?${searchParams.toString()}`,
      );
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

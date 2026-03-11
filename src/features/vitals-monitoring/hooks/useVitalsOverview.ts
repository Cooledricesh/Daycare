'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { VitalsOverviewItem } from '../backend/schema';

export function useVitalsOverview() {
  return useQuery({
    queryKey: ['shared', 'vitals-overview'],
    queryFn: async () => {
      const response = await apiClient.get<VitalsOverviewItem[]>('/api/shared/vitals/overview');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

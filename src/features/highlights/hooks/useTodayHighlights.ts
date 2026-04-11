'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { TodayHighlightsResponse } from '../lib/dto';

export function useTodayHighlights() {
  return useQuery<TodayHighlightsResponse>({
    queryKey: ['highlights', 'today'],
    queryFn: async () => {
      const response = await apiClient.get<TodayHighlightsResponse>(
        '/api/shared/highlights/today',
      );
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

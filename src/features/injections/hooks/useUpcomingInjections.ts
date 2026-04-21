'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { injectionsKeys } from './query-keys';
import type { UpcomingInjectionsResponse } from '../lib/dto';

const STALE_TIME_MS = 10 * 60 * 1000;
const DEFAULT_DAYS = 7;

export const useUpcomingInjections = (days: number = DEFAULT_DAYS) => {
  return useQuery<UpcomingInjectionsResponse>({
    queryKey: injectionsKeys.upcoming.list(days),
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await apiClient.get<UpcomingInjectionsResponse>(
        `/api/shared/injections/upcoming?days=${days}`,
      );
      return data;
    },
  });
};

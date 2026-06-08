'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { streakKeys } from './streak-keys';
import type { StreaksResponse } from '../backend/streaks-schema';

const STALE_TIME_MS = 60_000;

export const useStreaks = (date?: string) => {
  return useQuery<StreaksResponse>({
    queryKey: streakKeys.byDate(date ?? ''),
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const query = date ? `?date=${date}` : '';
      const { data } = await apiClient.get<StreaksResponse>(
        `/api/shared/attendance-board/streaks${query}`,
      );
      return data;
    },
  });
};

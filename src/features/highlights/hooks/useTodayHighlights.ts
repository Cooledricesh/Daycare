'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { getMillisecondsUntilNextKstMidnight, getTodayString } from '@/lib/date';
import type { TodayHighlightsResponse } from '../lib/dto';

export function useTodayHighlights() {
  const [today, setToday] = useState(() => getTodayString());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleDateRollover = () => {
      timeoutId = setTimeout(() => {
        setToday(getTodayString());
        scheduleDateRollover();
      }, getMillisecondsUntilNextKstMidnight() + 100);
    };

    scheduleDateRollover();
    return () => clearTimeout(timeoutId);
  }, []);

  return useQuery<TodayHighlightsResponse>({
    queryKey: ['highlights', 'today', today],
    queryFn: async () => {
      const response = await apiClient.get<TodayHighlightsResponse>(
        '/api/shared/highlights/today',
      );
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: 'always',
  });
}

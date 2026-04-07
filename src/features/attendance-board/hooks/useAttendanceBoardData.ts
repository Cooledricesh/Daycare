'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { attendanceBoardKeys } from './query-keys';
import type { AttendanceBoardResponse } from '../backend/schema';
import { BOARD_CONFIG } from '../constants/board-config';

export const useAttendanceBoardData = (date?: string) => {
  return useQuery({
    queryKey: attendanceBoardKeys.board.byDate(date ?? ''),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (date) {
        searchParams.append('date', date);
      }
      const query = searchParams.toString();
      const url = `/api/shared/attendance-board${query ? `?${query}` : ''}`;
      const { data } = await apiClient.get<AttendanceBoardResponse>(url);
      return data;
    },
    refetchInterval: BOARD_CONFIG.REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    retry: 1,
  });
};

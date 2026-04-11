'use client';

import { useQueries } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { sharedKeys } from './query-keys';

interface CalendarData {
  attended_dates: string[];
  scheduled_dates: string[];
  consulted_dates: string[];
}

interface MonthKey {
  year: number;
  month: number; // 1-12
}

export function useMultiMonthAttendanceCalendar(
  patientId: string,
  months: MonthKey[],
  enabled = true,
) {
  const queries = useQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: sharedKeys.attendanceCalendar.detail(patientId, year, month),
      queryFn: async () => {
        const params = new URLSearchParams({
          year: String(year),
          month: String(month),
        });
        const response = await apiClient.get<CalendarData>(
          `/api/shared/patient/${patientId}/attendance-calendar?${params}`,
        );
        return { year, month, data: response.data };
      },
      enabled: enabled && !!patientId,
      staleTime: 5 * 60 * 1000,
    })),
  });

  return {
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    months: queries
      .map((q) => q.data)
      .filter((d): d is { year: number; month: number; data: CalendarData } => !!d),
  };
}

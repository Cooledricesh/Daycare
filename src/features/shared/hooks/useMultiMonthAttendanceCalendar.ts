'use client';

import { useQuery } from '@tanstack/react-query';
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

interface MonthResult {
  year: number;
  month: number;
  data: CalendarData;
}

interface AttendanceCalendarRangeResponse {
  months: Array<{ year: number; month: number } & CalendarData>;
}

function toYearMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function useMultiMonthAttendanceCalendar(
  patientId: string,
  months: MonthKey[],
  enabled = true,
) {
  const from = months.length > 0
    ? toYearMonthParam(months[0].year, months[0].month)
    : '';
  const to = months.length > 0
    ? toYearMonthParam(months[months.length - 1].year, months[months.length - 1].month)
    : '';

  const query = useQuery({
    queryKey: sharedKeys.attendanceCalendarRange.detail(patientId, from, to),
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      const response = await apiClient.get<AttendanceCalendarRangeResponse>(
        `/api/shared/patient/${patientId}/attendance-calendar/range?${params}`,
      );
      return response.data;
    },
    enabled: enabled && !!patientId && months.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const monthResults: MonthResult[] = (query.data?.months ?? []).map((m) => ({
    year: m.year,
    month: m.month,
    data: {
      attended_dates: m.attended_dates,
      scheduled_dates: m.scheduled_dates,
      consulted_dates: m.consulted_dates,
    },
  }));

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    months: monthResults,
  };
}

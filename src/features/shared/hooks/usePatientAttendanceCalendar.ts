'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';

interface CalendarData {
  attended_dates: string[];
  scheduled_dates: string[];
  consulted_dates: string[];
}

export function usePatientAttendanceCalendar({
  patientId,
  year,
  month,
  enabled = true,
}: {
  patientId: string;
  year: number;
  month: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['shared', 'attendance-calendar', patientId, year, month],
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      const response = await apiClient.get<CalendarData>(
        `/api/shared/patient/${patientId}/attendance-calendar?${params}`
      );
      return response.data;
    },
    enabled: enabled && !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

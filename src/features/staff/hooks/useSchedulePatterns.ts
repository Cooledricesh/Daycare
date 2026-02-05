'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { MyPatientSchedulePattern, UpdateSchedulePatternRequest } from '../backend/schema';

interface SchedulePatternsResponse {
  patterns: MyPatientSchedulePattern[];
}

export function useMySchedulePatterns() {
  return useQuery({
    queryKey: ['staff', 'schedule-patterns'],
    queryFn: async () => {
      const response = await apiClient.get<SchedulePatternsResponse>(
        '/api/staff/schedule-patterns'
      );
      return response.data.patterns;
    },
    staleTime: 3 * 60 * 1000,
  });
}

export function useUpdateSchedulePattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: UpdateSchedulePatternRequest;
    }) => {
      const response = await apiClient.put<{ success: boolean }>(
        `/api/staff/schedule-patterns/${patientId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'schedule-patterns'] });
    },
  });
}

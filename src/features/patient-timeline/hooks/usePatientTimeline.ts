'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { PatientTimelineResponse } from '../lib/dto';

export function usePatientTimeline(patientId: string, enabled = true) {
  return useQuery<PatientTimelineResponse>({
    queryKey: ['patient-timeline', patientId],
    queryFn: async () => {
      const response = await apiClient.get<PatientTimelineResponse>(
        `/api/shared/patient/${patientId}/timeline`,
      );
      return response.data;
    },
    enabled: enabled && !!patientId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

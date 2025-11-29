'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import type { PatientSummary } from '../backend/schema';

type UseMyPatientsParams = {
  date?: string;
};

type UseMyPatientsResponse = {
  patients: PatientSummary[];
};

export const useMyPatients = (params: UseMyPatientsParams = {}) => {
  return useQuery({
    queryKey: ['staff', 'my-patients', params.date],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) {
        searchParams.append('date', params.date);
      }

      const { data } = await apiClient.get<UseMyPatientsResponse>(
        `/api/staff/my-patients?${searchParams.toString()}`,
      );

      return data;
    },
    retry: 1,
  });
};

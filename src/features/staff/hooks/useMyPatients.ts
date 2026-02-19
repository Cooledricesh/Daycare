'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import type { PatientSummary } from '../backend/schema';

type UseMyPatientsParams = {
  date?: string;
  showAll?: boolean;
};

type UseMyPatientsResponse = {
  patients: PatientSummary[];
};

export const useMyPatients = (params: UseMyPatientsParams = {}) => {
  return useQuery({
    queryKey: ['staff', 'my-patients', params.date, params.showAll],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) {
        searchParams.append('date', params.date);
      }
      if (params.showAll) {
        searchParams.append('show_all', 'true');
      }

      const { data } = await apiClient.get<UseMyPatientsResponse>(
        `/api/staff/my-patients?${searchParams.toString()}`,
      );

      return data;
    },
    retry: 1,
  });
};

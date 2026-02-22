'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { NursePatientSummary } from '../backend/schema';

type UseNursePatientsParams = {
  date?: string;
  filter?: 'all' | 'pending' | 'completed';
};

type UseNursePatientsResponse = {
  patients: NursePatientSummary[];
};

export const useNursePatients = (params: UseNursePatientsParams = {}) => {
  return useQuery({
    queryKey: ['nurse', 'patients', params.date, params.filter],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) searchParams.append('date', params.date);
      if (params.filter) searchParams.append('filter', params.filter);

      const { data } = await apiClient.get<UseNursePatientsResponse>(
        `/api/nurse/patients?${searchParams.toString()}`,
      );
      return data;
    },
    retry: 1,
  });
};

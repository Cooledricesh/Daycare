'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { WaitingPatient } from '../backend/schema';

type UseWaitingPatientsParams = {
  date?: string;
};

export function useWaitingPatients(params: UseWaitingPatientsParams = {}) {
  return useQuery({
    queryKey: ['doctor', 'waiting-patients', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) {
        searchParams.set('date', params.date);
      }

      const queryString = searchParams.toString();
      const url = `/api/doctor/waiting-patients${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<WaitingPatient[]>(url);
      return response.data;
    },
    refetchInterval: 30000, // 30초마다 자동 갱신
  });
}

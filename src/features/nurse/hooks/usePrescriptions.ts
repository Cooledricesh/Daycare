'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { PrescriptionItem } from '../backend/schema';

type UsePrescriptionsParams = {
  date?: string;
  filter?: 'all' | 'pending' | 'completed';
};

type UsePrescriptionsResponse = {
  prescriptions: PrescriptionItem[];
};

export const usePrescriptions = (params: UsePrescriptionsParams = {}) => {
  return useQuery({
    queryKey: ['nurse', 'prescriptions', params.date, params.filter],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) {
        searchParams.append('date', params.date);
      }
      if (params.filter) {
        searchParams.append('filter', params.filter);
      }

      const { data } = await apiClient.get<UsePrescriptionsResponse>(
        `/api/nurse/prescriptions?${searchParams.toString()}`,
      );

      return data;
    },
    retry: 1,
  });
};

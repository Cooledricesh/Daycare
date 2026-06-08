'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { injectionsKeys } from './query-keys';
import type { PatientInjectionHistoryResponse } from '../lib/dto';

const STALE_TIME_MS = 10 * 60 * 1000;

export const usePatientInjectionHistory = (patientId: string | null | undefined) => {
  return useQuery<PatientInjectionHistoryResponse>({
    queryKey: injectionsKeys.patient.history(patientId ?? ''),
    enabled: Boolean(patientId),
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await apiClient.get<PatientInjectionHistoryResponse>(
        `/api/shared/injections/patient/${patientId}/history`,
      );
      return data;
    },
  });
};

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from './query-keys';
import type { PatientDetail } from '../backend/schema';

type UsePatientDetailParams = {
  patientId: string;
  date?: string;
  enabled?: boolean;
};

type UsePatientDetailResponse = {
  patient: PatientDetail;
};

export const usePatientDetail = (params: UsePatientDetailParams) => {
  return useQuery({
    queryKey: staffKeys.patient.detail(params.patientId, params.date ?? ''),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) {
        searchParams.append('date', params.date);
      }

      const { data } = await apiClient.get<UsePatientDetailResponse>(
        `/api/staff/patient/${params.patientId}?${searchParams.toString()}`,
      );

      return data;
    },
    enabled: params.enabled !== false,
    retry: 1,
  });
};

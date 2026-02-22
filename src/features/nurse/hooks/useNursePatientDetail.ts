'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { PatientDetail } from '@/features/staff/backend/schema';

type UseNursePatientDetailParams = {
  patientId: string;
  date?: string;
  enabled?: boolean;
};

type UseNursePatientDetailResponse = {
  patient: PatientDetail;
};

export const useNursePatientDetail = (params: UseNursePatientDetailParams) => {
  return useQuery({
    queryKey: ['nurse', 'patient', params.patientId, params.date],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) {
        searchParams.append('date', params.date);
      }

      const { data } = await apiClient.get<UseNursePatientDetailResponse>(
        `/api/nurse/patient/${params.patientId}?${searchParams.toString()}`,
      );

      return data;
    },
    enabled: params.enabled !== false,
    retry: 1,
  });
};

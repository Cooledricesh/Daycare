'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { PatientHistory } from '../backend/schema';

interface UsePatientHistoryParams {
  patientId: string;
  months?: number;
}

export function usePatientHistory({ patientId, months = 1 }: UsePatientHistoryParams) {
  return useQuery({
    queryKey: ['doctor', 'patient-history', patientId, months],
    queryFn: async () => {
      const url = `/api/doctor/history/${patientId}?months=${months}`;
      const response = await apiClient.get<PatientHistory>(url);
      return response.data;
    },
    enabled: !!patientId,
  });
}

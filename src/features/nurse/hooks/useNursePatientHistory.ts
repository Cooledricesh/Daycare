'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { PatientHistory } from '@/features/doctor/backend/schema';

interface UseNursePatientHistoryParams {
  patientId: string;
  months?: number;
  enabled?: boolean;
}

export function useNursePatientHistory({
  patientId,
  months = 24,
  enabled = true,
}: UseNursePatientHistoryParams) {
  return useQuery({
    queryKey: ['nurse', 'patient-history', patientId, months],
    queryFn: async () => {
      const url = `/api/nurse/patient/${patientId}/history?months=${months}`;
      const response = await apiClient.get<PatientHistory>(url);
      return response.data;
    },
    enabled: enabled && !!patientId,
  });
}

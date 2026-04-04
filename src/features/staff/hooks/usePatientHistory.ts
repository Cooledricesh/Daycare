'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from './query-keys';
import type { PatientHistory } from '@/features/doctor/backend/schema';

interface UseStaffPatientHistoryParams {
  patientId: string;
  months?: number;
  enabled?: boolean;
}

export function useStaffPatientHistory({
  patientId,
  months = 24,
  enabled = true,
}: UseStaffPatientHistoryParams) {
  return useQuery({
    queryKey: staffKeys.patientHistory.detail(patientId, months),
    queryFn: async () => {
      const url = `/api/staff/patient/${patientId}/history?months=${months}`;
      const response = await apiClient.get<PatientHistory>(url);
      return response.data;
    },
    enabled: enabled && !!patientId,
  });
}

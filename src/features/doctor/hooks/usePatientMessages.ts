'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { PatientMessage } from '../backend/schema';

type UsePatientMessagesParams = {
  patientId: string | null;
  date?: string;
};

export function usePatientMessages(params: UsePatientMessagesParams) {
  return useQuery({
    queryKey: ['doctor', 'patient-messages', params.patientId, params.date],
    queryFn: async () => {
      if (!params.patientId) return [];

      const searchParams = new URLSearchParams();
      if (params.date) {
        searchParams.set('date', params.date);
      }

      const queryString = searchParams.toString();
      const url = `/api/doctor/patients/${params.patientId}/messages${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<PatientMessage[]>(url);
      return response.data;
    },
    enabled: !!params.patientId,
  });
}

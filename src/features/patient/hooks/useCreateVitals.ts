import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { CreateVitalsRequest, Vitals } from '../backend/schema';

interface CreateVitalsResponse {
  vitals: Vitals;
}

export function useCreateVitals() {
  return useMutation({
    mutationFn: async (data: CreateVitalsRequest) => {
      const response = await apiClient.post<CreateVitalsResponse>('/api/patients/vitals', data);
      return response.data.vitals;
    },
  });
}

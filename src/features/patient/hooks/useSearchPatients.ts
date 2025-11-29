import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { Patient } from '../backend/schema';

interface SearchPatientsResponse {
  patients: Patient[];
}

export function useSearchPatients(query: string) {
  return useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: async () => {
      const response = await apiClient.get<SearchPatientsResponse>('/api/patients/search', {
        params: { q: query },
      });
      return response.data.patients;
    },
    enabled: query.length > 0,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

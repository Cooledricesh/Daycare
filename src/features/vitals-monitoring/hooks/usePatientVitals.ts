'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { PatientVitalsDetail } from '../backend/schema';
import type { VitalsPeriod } from '../constants/vitals-ranges';
import { sharedKeys } from '../../shared/hooks/query-keys';

export function usePatientVitals(patientId: string | null, period: VitalsPeriod) {
  return useQuery({
    queryKey: sharedKeys.patientVitals.detail(patientId ?? '', period),
    queryFn: async () => {
      const response = await apiClient.get<PatientVitalsDetail>(
        `/api/shared/vitals/${patientId}?period=${period}`
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

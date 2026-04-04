'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { PatientAbsenceDetail } from '../backend/schema';
import type { AbsencePeriod } from '../constants/risk-thresholds';
import { sharedKeys } from '@/features/shared/hooks/query-keys';

export function useAbsenceDetail(patientId: string | null, period: AbsencePeriod = '30d') {
  return useQuery({
    queryKey: sharedKeys.absenceRiskDetail.detail(patientId ?? '', period),
    queryFn: async () => {
      const response = await apiClient.get<PatientAbsenceDetail>(
        `/api/shared/absence-risk/${patientId}?period=${period}`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

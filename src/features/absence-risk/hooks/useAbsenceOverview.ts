'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { AbsenceOverviewItem } from '../backend/schema';
import type { AbsencePeriod } from '../constants/risk-thresholds';
import { sharedKeys } from '@/features/shared/hooks/query-keys';

export function useAbsenceOverview(period: AbsencePeriod = '30d') {
  return useQuery({
    queryKey: sharedKeys.absenceRiskOverview.detail(period),
    queryFn: async () => {
      const response = await apiClient.get<AbsenceOverviewItem[]>(
        `/api/shared/absence-risk/overview?period=${period}`,
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

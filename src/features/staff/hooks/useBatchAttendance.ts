'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from './query-keys';
import { sharedKeys } from '../../shared/hooks/query-keys';

interface BatchAttendanceParams {
  patientIds: string[];
  date?: string;
}

interface BatchAttendanceResult {
  created: number;
  skipped: number;
}

interface BatchCancelResult {
  cancelled: number;
  skippedConsulted: number;
  clearedCoordinatorConsultations: number;
}

export function useBatchAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BatchAttendanceParams) => {
      const response = await apiClient.post<BatchAttendanceResult>(
        '/api/staff/attendances/batch',
        {
          patient_ids: params.patientIds,
          date: params.date,
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.myPatients.all });
      queryClient.invalidateQueries({ queryKey: sharedKeys.absenceRiskOverview.all });
    },
  });
}

export function useCancelAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BatchAttendanceParams) => {
      const response = await apiClient.post<BatchCancelResult>(
        '/api/staff/attendances/cancel',
        {
          patient_ids: params.patientIds,
          date: params.date,
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.myPatients.all });
      queryClient.invalidateQueries({ queryKey: sharedKeys.absenceRiskOverview.all });
    },
  });
}

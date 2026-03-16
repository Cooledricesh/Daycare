'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';

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
      queryClient.invalidateQueries({ queryKey: ['staff', 'my-patients'] });
      queryClient.invalidateQueries({ queryKey: ['shared', 'absence-risk-overview'] });
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
      queryClient.invalidateQueries({ queryKey: ['staff', 'my-patients'] });
      queryClient.invalidateQueries({ queryKey: ['shared', 'absence-risk-overview'] });
    },
  });
}

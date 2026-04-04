'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from './query-keys';
import { sharedKeys } from '../../shared/hooks/query-keys';

interface BatchConsultationParams {
  patientIds: string[];
  date?: string;
}

interface BatchConsultationResult {
  created: number;
  skippedAlreadyConsulted: number;
  skippedNotAttended: number;
  skippedNoDoctor: number;
}

interface BatchCancelConsultationResult {
  cancelled: number;
  skippedDoctorConsulted: number;
}

export function useBatchConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BatchConsultationParams) => {
      const response = await apiClient.post<BatchConsultationResult>(
        '/api/staff/consultations/batch',
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

export function useCancelConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BatchConsultationParams) => {
      const response = await apiClient.post<BatchCancelConsultationResult>(
        '/api/staff/consultations/cancel',
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

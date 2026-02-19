'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { CreateConsultationRequest, CreatedConsultation } from '../backend/schema';

export function useCreateConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateConsultationRequest) => {
      const response = await apiClient.post<CreatedConsultation>(
        '/api/doctor/consultations',
        params,
      );
      return response.data;
    },
    onSuccess: () => {
      // 대기 환자 목록 갱신
      queryClient.invalidateQueries({ queryKey: ['doctor', 'waiting-patients'] });
      // 지시사항 목록 갱신
      queryClient.invalidateQueries({ queryKey: ['doctor', 'tasks'] });
      // 환자 히스토리 갱신 (우측 패널 자동 반영)
      queryClient.invalidateQueries({ queryKey: ['doctor', 'patient-history'] });
    },
  });
}

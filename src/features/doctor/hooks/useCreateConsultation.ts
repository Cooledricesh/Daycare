'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { CreateConsultationRequest, CreatedConsultation } from '../backend/schema';
import { doctorKeys } from './query-keys';
import { sharedKeys } from '../../shared/hooks/query-keys';

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
      queryClient.invalidateQueries({ queryKey: doctorKeys.waitingPatients.all });
      // 지시사항 목록 갱신
      queryClient.invalidateQueries({ queryKey: sharedKeys.tasks.all });
      // 환자 히스토리 갱신 (우측 패널 자동 반영)
      queryClient.invalidateQueries({ queryKey: doctorKeys.patientHistory.all });
      // 출석 캘린더 갱신 (진찰 시 자동 출석 생성 반영)
      queryClient.invalidateQueries({ queryKey: sharedKeys.attendanceCalendar.all });
      // 결석 위험도 갱신 (진찰 시 자동 출석 생성 반영)
      queryClient.invalidateQueries({ queryKey: sharedKeys.absenceRiskOverview.all });
    },
  });
}

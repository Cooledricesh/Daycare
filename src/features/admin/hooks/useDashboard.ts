'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { NursePatientSummary } from '@/features/nurse/backend/schema';
import type { PatientDetail } from '@/features/staff/backend/schema';
import type { PatientHistory } from '@/features/doctor/backend/schema';

// ===== Query Hooks =====

type UseAdminPatientsParams = {
  date?: string;
};

type UseAdminPatientsResponse = {
  patients: NursePatientSummary[];
};

export const useAdminPatients = (params: UseAdminPatientsParams = {}) => {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'patients', params.date],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) searchParams.append('date', params.date);

      const { data } = await apiClient.get<UseAdminPatientsResponse>(
        `/api/admin/dashboard/patients?${searchParams.toString()}`,
      );
      return data;
    },
    retry: 1,
  });
};

type UseAdminPatientDetailParams = {
  patientId: string;
  date?: string;
  enabled?: boolean;
};

type UseAdminPatientDetailResponse = {
  patient: PatientDetail;
};

export const useAdminPatientDetail = (params: UseAdminPatientDetailParams) => {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'patient', params.patientId, params.date],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) searchParams.append('date', params.date);

      const { data } = await apiClient.get<UseAdminPatientDetailResponse>(
        `/api/admin/dashboard/patient/${params.patientId}?${searchParams.toString()}`,
      );
      return data;
    },
    enabled: params.enabled !== false,
    retry: 1,
  });
};

type UseAdminPatientHistoryParams = {
  patientId: string;
  months?: number;
  enabled?: boolean;
};

export function useAdminPatientHistory({
  patientId,
  months = 24,
  enabled = true,
}: UseAdminPatientHistoryParams) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'patient-history', patientId, months],
    queryFn: async () => {
      const url = `/api/admin/dashboard/patient/${patientId}/history?months=${months}`;
      const response = await apiClient.get<PatientHistory>(url);
      return response.data;
    },
    enabled: enabled && !!patientId,
  });
}

// ===== Mutation Hooks =====

type CreateMessageParams = {
  patientId: string;
  date: string;
  content: string;
};

export const useAdminCreateMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateMessageParams) => {
      const { data } = await apiClient.post(
        '/api/admin/dashboard/messages',
        {
          patient_id: params.patientId,
          date: params.date,
          content: params.content,
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'patient'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'patient-history'] });
    },
  });
};

export const useAdminDeleteMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      await apiClient.delete(`/api/admin/dashboard/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'patient'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'patient-history'] });
    },
  });
};

type CompleteTaskParams = {
  consultationId: string;
  memo?: string;
};

export const useAdminCompleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CompleteTaskParams) => {
      const { data } = await apiClient.post(
        `/api/admin/dashboard/task/${params.consultationId}/complete`,
        { memo: params.memo },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
};

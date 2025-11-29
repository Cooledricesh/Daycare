'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type {
  GetPatientsQuery,
  CreatePatientRequest,
  UpdatePatientRequest,
  PatientWithCoordinator,
  PatientDetail,
} from '../backend/schema';

interface PatientsResponse {
  data: PatientWithCoordinator[];
  total: number;
  page: number;
  limit: number;
}

export function usePatients(query: Partial<GetPatientsQuery>) {
  return useQuery({
    queryKey: ['admin', 'patients', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      if (query.search) params.set('search', query.search);
      if (query.status) params.set('status', query.status);
      if (query.coordinator_id) params.set('coordinator_id', query.coordinator_id);

      const response = await apiClient.get<PatientsResponse>(
        `/api/admin/patients?${params.toString()}`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePatientDetail(patientId: string | null) {
  return useQuery({
    queryKey: ['admin', 'patients', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const response = await apiClient.get<PatientDetail>(
        `/api/admin/patients/${patientId}`
      );
      return response.data;
    },
    enabled: !!patientId,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePatientRequest) => {
      const response = await apiClient.post<PatientWithCoordinator>(
        '/api/admin/patients',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'patients'] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdatePatientRequest;
    }) => {
      const response = await apiClient.put<PatientWithCoordinator>(
        `/api/admin/patients/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'patients'] });
    },
  });
}

export function useCoordinators() {
  return useQuery({
    queryKey: ['admin', 'coordinators'],
    queryFn: async () => {
      const response = await apiClient.get<{ coordinators: any[] }>(
        '/api/admin/coordinators'
      );
      return response.data.coordinators;
    },
    staleTime: 10 * 60 * 1000,
  });
}

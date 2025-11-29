'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type {
  GetStaffQuery,
  CreateStaffRequest,
  UpdateStaffRequest,
  ResetPasswordRequest,
  StaffPublic,
} from '../backend/schema';

interface StaffResponse {
  data: StaffPublic[];
  total: number;
  page: number;
  limit: number;
}

export function useStaff(query: Partial<GetStaffQuery>) {
  return useQuery({
    queryKey: ['admin', 'staff', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));
      if (query.role) params.set('role', query.role);
      if (query.status) params.set('status', query.status);

      const response = await apiClient.get<StaffResponse>(
        `/api/admin/staff?${params.toString()}`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useStaffById(staffId: string | null) {
  return useQuery({
    queryKey: ['admin', 'staff', staffId],
    queryFn: async () => {
      if (!staffId) return null;
      const response = await apiClient.get<StaffPublic>(
        `/api/admin/staff/${staffId}`
      );
      return response.data;
    },
    enabled: !!staffId,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStaffRequest) => {
      const response = await apiClient.post<StaffPublic>('/api/admin/staff', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateStaffRequest }) => {
      const response = await apiClient.put<StaffPublic>(
        `/api/admin/staff/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ResetPasswordRequest }) => {
      const response = await apiClient.post<{ success: boolean }>(
        `/api/admin/staff/${id}/reset-password`,
        data
      );
      return response.data;
    },
  });
}

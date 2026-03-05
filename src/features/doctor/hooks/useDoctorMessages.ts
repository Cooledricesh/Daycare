'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { DoctorMessage } from '../backend/schema';

interface UseDoctorMessagesParams {
  startDate?: string;
  endDate?: string;
  isRead?: 'all' | 'read' | 'unread';
}

export function useDoctorMessages(params: UseDoctorMessagesParams = {}) {
  return useQuery({
    queryKey: ['shared', 'messages', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.startDate) searchParams.set('start_date', params.startDate);
      if (params.endDate) searchParams.set('end_date', params.endDate);
      if (params.isRead && params.isRead !== 'all') searchParams.set('is_read', params.isRead);

      const queryString = searchParams.toString();
      const url = `/api/shared/messages${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<DoctorMessage[]>(url);
      return response.data;
    },
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const response = await apiClient.post<{ success: boolean }>(
        `/api/shared/messages/${messageId}/read`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['shared', 'tasks'] });
    },
  });
}

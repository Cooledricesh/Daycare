'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { DoctorMessage } from '../backend/schema';
import { sharedKeys } from '../../shared/hooks/query-keys';

interface UseDoctorMessagesParams {
  startDate?: string;
  endDate?: string;
  isRead?: 'all' | 'read' | 'unread';
}

export function useDoctorMessages(params: UseDoctorMessagesParams = {}) {
  return useQuery({
    queryKey: sharedKeys.messages.list(params),
    staleTime: 60 * 1000,
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
      queryClient.invalidateQueries({ queryKey: sharedKeys.messages.all });
      queryClient.invalidateQueries({ queryKey: sharedKeys.tasks.all });
    },
  });
}

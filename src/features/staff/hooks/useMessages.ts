'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { MessageItem } from '../backend/schema';

interface UseMessagesParams {
  date?: string;
}

export function useMessages(params: UseMessagesParams = {}) {
  return useQuery({
    queryKey: ['staff', 'messages', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) searchParams.set('date', params.date);

      const queryString = searchParams.toString();
      const url = `/api/staff/messages${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<{ messages: MessageItem[] }>(url);
      return response.data.messages;
    },
  });
}

interface CreateMessageParams {
  patient_id: string;
  date: string;
  content: string;
}

export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateMessageParams) => {
      const response = await apiClient.post('/api/staff/messages', params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'messages'] });
    },
  });
}

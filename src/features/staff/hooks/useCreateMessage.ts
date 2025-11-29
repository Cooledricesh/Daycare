'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import type { Message } from '../backend/schema';

type CreateMessageParams = {
  patientId: string;
  date: string;
  content: string;
};

type CreateMessageResponse = {
  message: Message;
};

export const useCreateMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateMessageParams) => {
      const { data } = await apiClient.post<CreateMessageResponse>(
        '/api/staff/messages',
        {
          patient_id: params.patientId,
          date: params.date,
          content: params.content,
        },
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'patient'] });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      throw new Error(message);
    },
  });
};

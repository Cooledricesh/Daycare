'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import type { Message } from '../backend/schema';
import { staffKeys } from './query-keys';

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
      queryClient.invalidateQueries({ queryKey: staffKeys.patient.all });
      queryClient.invalidateQueries({ queryKey: staffKeys.patientHistory.all });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      throw new Error(message);
    },
  });
};

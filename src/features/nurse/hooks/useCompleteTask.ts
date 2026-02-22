'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import type { TaskCompletion } from '../backend/schema';

type CompleteTaskParams = {
  consultationId: string;
  memo?: string;
};

type CompleteTaskResponse = {
  task_completion: TaskCompletion;
};

export const useCompleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CompleteTaskParams) => {
      const { data } = await apiClient.post<CompleteTaskResponse>(
        `/api/nurse/task/${params.consultationId}/complete`,
        {
          memo: params.memo,
        },
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurse', 'prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['nurse', 'patients'] });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      throw new Error(message);
    },
  });
};

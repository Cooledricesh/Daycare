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
        `/api/staff/task/${params.consultationId}/complete`,
        {
          memo: params.memo,
        },
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'my-patients'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'patient'] });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      throw new Error(message);
    },
  });
};

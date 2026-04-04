'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import type { TaskCompletion } from '../backend/schema';
import { nurseKeys } from './query-keys';

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
      queryClient.invalidateQueries({ queryKey: nurseKeys.prescriptions.all });
      queryClient.invalidateQueries({ queryKey: nurseKeys.patients.all });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      throw new Error(message);
    },
  });
};

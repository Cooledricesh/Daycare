'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import { staffKeys } from './query-keys';
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
      queryClient.invalidateQueries({ queryKey: staffKeys.myPatients.all });
      queryClient.invalidateQueries({ queryKey: staffKeys.patient.all });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error);
      throw new Error(message);
    },
  });
};

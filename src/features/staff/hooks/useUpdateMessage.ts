'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from './query-keys';

interface UpdateMessageParams {
  messageId: string;
  content: string;
}

export const useUpdateMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content }: UpdateMessageParams) => {
      await apiClient.patch(`/api/staff/messages/${messageId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.patient.all });
      queryClient.invalidateQueries({ queryKey: staffKeys.patientHistory.all });
    },
  });
};

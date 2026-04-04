'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { nurseKeys } from './query-keys';

interface UpdateMessageParams {
  messageId: string;
  content: string;
}

export const useNurseUpdateMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content }: UpdateMessageParams) => {
      await apiClient.patch(`/api/nurse/messages/${messageId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nurseKeys.patient.all });
      queryClient.invalidateQueries({ queryKey: nurseKeys.patientHistory.all });
    },
  });
};

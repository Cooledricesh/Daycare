'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';

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
      queryClient.invalidateQueries({ queryKey: ['nurse', 'patient'] });
      queryClient.invalidateQueries({ queryKey: ['nurse', 'patient-history'] });
    },
  });
};

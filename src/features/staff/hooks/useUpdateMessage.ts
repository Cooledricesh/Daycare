'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';

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
      queryClient.invalidateQueries({ queryKey: ['staff', 'patient'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'patient-history'] });
    },
  });
};

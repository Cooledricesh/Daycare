'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from './query-keys';

export const useDeleteMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      await apiClient.delete(`/api/staff/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.patient.all });
      queryClient.invalidateQueries({ queryKey: staffKeys.patientHistory.all });
    },
  });
};

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { nurseKeys } from './query-keys';

export const useNurseDeleteMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      await apiClient.delete(`/api/nurse/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nurseKeys.patient.all });
      queryClient.invalidateQueries({ queryKey: nurseKeys.patientHistory.all });
    },
  });
};

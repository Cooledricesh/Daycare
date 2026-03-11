'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';

interface UpdateDisplayNameParams {
  patientId: string;
  displayName: string | null;
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ patientId, displayName }: UpdateDisplayNameParams) => {
      const response = await apiClient.patch(`/api/shared/patients/${patientId}/display-name`, {
        display_name: displayName,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['doctor'] });
      queryClient.invalidateQueries({ queryKey: ['nurse'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from '../../staff/hooks/query-keys';
import { adminKeys } from '../../admin/hooks/query-keys';
import { doctorKeys } from '../../doctor/hooks/query-keys';
import { nurseKeys } from '../../nurse/hooks/query-keys';

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
      queryClient.invalidateQueries({ queryKey: staffKeys.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
      queryClient.invalidateQueries({ queryKey: doctorKeys.all });
      queryClient.invalidateQueries({ queryKey: nurseKeys.all });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

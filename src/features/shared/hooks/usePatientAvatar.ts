'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from '../../staff/hooks/query-keys';
import { adminKeys } from '../../admin/hooks/query-keys';
import { doctorKeys } from '../../doctor/hooks/query-keys';
import { nurseKeys } from '../../nurse/hooks/query-keys';

function useInvalidatePatientQueries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: staffKeys.all });
    queryClient.invalidateQueries({ queryKey: adminKeys.all });
    queryClient.invalidateQueries({ queryKey: doctorKeys.all });
    queryClient.invalidateQueries({ queryKey: nurseKeys.all });
    queryClient.invalidateQueries({ queryKey: ['patients'] });
  };
}

export function useUploadAvatar() {
  const invalidate = useInvalidatePatientQueries();

  return useMutation({
    mutationFn: async ({ patientId, file }: { patientId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post(`/api/shared/patients/${patientId}/avatar`, formData);
      return response.data as { avatar_url: string };
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAvatar() {
  const invalidate = useInvalidatePatientQueries();

  return useMutation({
    mutationFn: async ({ patientId }: { patientId: string }) => {
      await apiClient.delete(`/api/shared/patients/${patientId}/avatar`);
    },
    onSuccess: invalidate,
  });
}

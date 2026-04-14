'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from '../../staff/hooks/query-keys';
import { adminKeys } from '../../admin/hooks/query-keys';
import { doctorKeys } from '../../doctor/hooks/query-keys';
import { nurseKeys } from '../../nurse/hooks/query-keys';

interface UpdatePatientBirthDateParams {
  patientId: string;
  birthDate: string | null;
}

export function useUpdatePatientBirthDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ patientId, birthDate }: UpdatePatientBirthDateParams) => {
      const response = await apiClient.patch(`/api/shared/patients/${patientId}/birth-date`, {
        birth_date: birthDate,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
      queryClient.invalidateQueries({ queryKey: doctorKeys.all });
      queryClient.invalidateQueries({ queryKey: nurseKeys.all });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['highlights'] });
    },
  });
}

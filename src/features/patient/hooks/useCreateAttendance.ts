import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { CreateAttendanceRequest, Attendance } from '../backend/schema';
import { sharedKeys } from '../../shared/hooks/query-keys';

interface CreateAttendanceResponse {
  attendance: Attendance;
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAttendanceRequest) => {
      const response = await apiClient.post<CreateAttendanceResponse>('/api/patients/attendances', data);
      return response.data.attendance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharedKeys.absenceRiskOverview.all });
    },
  });
}

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { CreateAttendanceRequest, Attendance } from '../backend/schema';

interface CreateAttendanceResponse {
  attendance: Attendance;
}

export function useCreateAttendance() {
  return useMutation({
    mutationFn: async (data: CreateAttendanceRequest) => {
      const response = await apiClient.post<CreateAttendanceResponse>('/api/attendances', data);
      return response.data.attendance;
    },
  });
}

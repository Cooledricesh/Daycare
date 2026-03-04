'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';

interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      const response = await apiClient.post<{ message: string }>(
        '/api/shared/change-password',
        data
      );
      return response.data;
    },
  });
}

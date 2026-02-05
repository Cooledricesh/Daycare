'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { TaskItem } from '../backend/schema';

interface UseTasksParams {
  date?: string;
  status?: 'all' | 'pending' | 'completed';
}

export function useTasks(params: UseTasksParams = {}) {
  return useQuery({
    queryKey: ['doctor', 'tasks', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.date) searchParams.set('date', params.date);
      if (params.status) searchParams.set('status', params.status);

      const queryString = searchParams.toString();
      const url = `/api/doctor/tasks${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<TaskItem[]>(url);
      return response.data;
    },
  });
}

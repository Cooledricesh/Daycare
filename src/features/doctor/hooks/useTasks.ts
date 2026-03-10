'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { TaskItem } from '../backend/schema';

interface UseTasksParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: 'all' | 'pending' | 'completed';
}

export function useTasks(params: UseTasksParams = {}) {
  return useQuery({
    queryKey: ['shared', 'tasks', params],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.startDate && params.endDate) {
        searchParams.set('start_date', params.startDate);
        searchParams.set('end_date', params.endDate);
      } else if (params.date) {
        searchParams.set('date', params.date);
      }
      if (params.status) searchParams.set('status', params.status);

      const queryString = searchParams.toString();
      const url = `/api/shared/tasks${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<TaskItem[]>(url);
      return response.data;
    },
  });
}

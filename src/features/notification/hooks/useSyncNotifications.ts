'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { SyncNotificationsResponse } from '../backend/schema';

const QUERY_KEY = ['notifications', 'sync'] as const;
const STALE_TIME = 5 * 60 * 1000; // 5분

async function fetchSyncNotifications(): Promise<SyncNotificationsResponse> {
  const { data } = await apiClient.get('/api/shared/notifications/sync');
  return data;
}

async function dismissNotification(syncLogId: string): Promise<void> {
  await apiClient.post('/api/shared/notifications/sync/dismiss', {
    sync_log_id: syncLogId,
  });
}

export function useSyncNotifications() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSyncNotifications,
    staleTime: STALE_TIME,
    retry: false,
  });
}

export function useDismissSyncNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

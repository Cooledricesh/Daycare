'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { SyncLogItem, GetSyncLogsQuery } from '../backend/schema';

interface SyncLogsResponse {
  data: SyncLogItem[];
  total: number;
  page: number;
  limit: number;
}

interface SyncResult {
  success: boolean;
  syncId: string;
  summary: {
    totalInSource: number;
    totalProcessed: number;
    inserted: number;
    updated: number;
    discharged: number;
    reactivated: number;
    unchanged: number;
    skipped: number;
  };
  changes: Array<{
    patientIdNo: string;
    name: string;
    action: 'insert' | 'update' | 'discharge' | 'reactivate';
    fields?: Record<string, { old: string | null; new: string | null }>;
  }>;
  skippedReasons: Array<{ patientIdNo: string; name: string; reason: string }>;
  errorMessage?: string;
}

export function useSyncLogs(query: Partial<GetSyncLogsQuery>) {
  return useQuery({
    queryKey: ['admin', 'sync-logs', query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.page) params.set('page', String(query.page));
      if (query.limit) params.set('limit', String(query.limit));

      const response = await apiClient.get<SyncLogsResponse>(
        `/api/admin/sync/logs?${params.toString()}`
      );
      return response.data;
    },
    staleTime: 30 * 1000, // 30초
  });
}

export function useSyncLogById(logId: string | null) {
  return useQuery({
    queryKey: ['admin', 'sync-logs', logId],
    queryFn: async () => {
      if (!logId) return null;
      const response = await apiClient.get<SyncLogItem>(
        `/api/admin/sync/logs/${logId}`
      );
      return response.data;
    },
    enabled: !!logId,
  });
}

export function useRunSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      dryRun = false,
    }: {
      file: File;
      dryRun?: boolean;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', String(dryRun));

      // FormData 전송 시 Content-Type 헤더를 설정하지 않음 (axios가 자동으로 boundary 포함하여 설정)
      const response = await apiClient.post<SyncResult>(
        '/api/admin/sync',
        formData
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'patients'] });
    },
  });
}

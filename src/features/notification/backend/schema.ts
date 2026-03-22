import { z } from 'zod';

// ========== Request Schemas ==========

export const dismissSyncNotificationSchema = z.object({
  sync_log_id: z.string().uuid('올바른 동기화 로그 ID가 필요합니다'),
});

export type DismissSyncNotificationRequest = z.infer<typeof dismissSyncNotificationSchema>;

// ========== Response Types ==========

export interface SyncChangeItem {
  name: string;
  action: 'insert' | 'discharge' | 'ward_admission' | 'activity_stop' | 'reactivate';
}

export interface SyncNotificationItem {
  sync_id: string;
  completed_at: string;
  changes: SyncChangeItem[];
}

export interface SyncNotificationsResponse {
  has_notifications: boolean;
  notifications: SyncNotificationItem[];
}

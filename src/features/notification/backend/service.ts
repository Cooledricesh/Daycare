import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, SyncChange } from '@/lib/supabase/types';
import type { SyncNotificationsResponse, SyncNotificationItem, SyncChangeItem } from './schema';

const RELEVANT_ACTIONS = new Set(['insert', 'discharge', 'reactivate']);

/**
 * 미확인 동기화 알림 조회
 * - 사용자의 last_dismissed_sync_id 이후에 완료된 sync_logs 중
 *   입원/퇴원/재입원 변동이 있는 항목만 반환
 */
export async function getSyncNotifications(
  supabase: SupabaseClient<Database>,
  staffId: string,
): Promise<SyncNotificationsResponse> {
  // 1. 사용자의 마지막 확인 sync_log ID 조회
  const { data: dismissal } = await (supabase
    .from('notification_dismissals') as any)
    .select('last_dismissed_sync_id')
    .eq('staff_id', staffId)
    .single();

  const lastDismissedSyncId = dismissal?.last_dismissed_sync_id ?? null;

  // 2. 입퇴원 변동이 있는 완료된 sync_logs 조회
  let query = (supabase
    .from('sync_logs') as any)
    .select('id, completed_at, inserted, discharged, reactivated, details')
    .eq('status', 'completed')
    .or('inserted.gt.0,discharged.gt.0,reactivated.gt.0')
    .order('completed_at', { ascending: false })
    .limit(10);

  // last_dismissed_sync_id가 있으면 그 이후 것만
  if (lastDismissedSyncId) {
    const { data: lastLog } = await (supabase
      .from('sync_logs') as any)
      .select('completed_at')
      .eq('id', lastDismissedSyncId)
      .single();

    if (lastLog?.completed_at) {
      query = query.gt('completed_at', lastLog.completed_at);
    }
  }

  const { data: syncLogs, error } = await query;

  if (error || !syncLogs || syncLogs.length === 0) {
    return { has_notifications: false, notifications: [] };
  }

  // 3. changes에서 입원/퇴원/재입원만 필터링
  const notifications: SyncNotificationItem[] = syncLogs
    .map((log: any) => {
      const allChanges: SyncChange[] = log.details?.changes ?? [];
      const relevantChanges: SyncChangeItem[] = allChanges
        .filter((c) => RELEVANT_ACTIONS.has(c.action))
        .map((c) => ({ name: c.name, action: c.action as SyncChangeItem['action'] }));

      if (relevantChanges.length === 0) return null;

      return {
        sync_id: log.id,
        completed_at: log.completed_at,
        changes: relevantChanges,
      };
    })
    .filter(Boolean) as SyncNotificationItem[];

  return {
    has_notifications: notifications.length > 0,
    notifications,
  };
}

/**
 * 동기화 알림 확인(닫기) 처리
 * - notification_dismissals UPSERT
 */
export async function dismissSyncNotification(
  supabase: SupabaseClient<Database>,
  staffId: string,
  syncLogId: string,
): Promise<void> {
  const { error } = await (supabase
    .from('notification_dismissals') as any)
    .upsert(
      {
        staff_id: staffId,
        last_dismissed_sync_id: syncLogId,
        dismissed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'staff_id' },
    );

  if (error) throw error;
}

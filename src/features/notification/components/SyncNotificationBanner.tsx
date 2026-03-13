'use client';

import { useState } from 'react';
import { Bell, X, UserPlus, UserMinus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSyncNotifications, useDismissSyncNotification } from '../hooks/useSyncNotifications';
import type { SyncChangeItem } from '../backend/schema';

const ACTION_CONFIG = {
  insert: { label: '입원', icon: UserPlus, textColor: 'text-blue-700' },
  discharge: { label: '퇴원', icon: UserMinus, textColor: 'text-orange-700' },
  reactivate: { label: '재입원', icon: RotateCcw, textColor: 'text-green-700' },
} as const;

type ActionType = keyof typeof ACTION_CONFIG;

function groupByAction(changes: SyncChangeItem[]): Record<ActionType, string[]> {
  const grouped: Record<ActionType, string[]> = {
    insert: [],
    discharge: [],
    reactivate: [],
  };

  for (const change of changes) {
    if (change.action in grouped) {
      grouped[change.action as ActionType].push(change.name);
    }
  }

  return grouped;
}

export function SyncNotificationBanner() {
  const { data, isLoading } = useSyncNotifications();
  const dismiss = useDismissSyncNotification();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isLoading || !data?.has_notifications || isDismissed) {
    return null;
  }

  const allChanges = data.notifications.flatMap((n) => n.changes);
  if (allChanges.length === 0) return null;

  const grouped = groupByAction(allChanges);
  const latestSyncId = data.notifications[0]?.sync_id;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (latestSyncId) {
      dismiss.mutate(latestSyncId);
    }
  };

  return (
    <div className="mx-4 mt-4 md:mx-6 md:mt-6">
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

        <div className="flex-1 min-w-0 text-sm">
          <p className="font-medium text-blue-900 mb-1">환자 명단 변동</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(Object.entries(ACTION_CONFIG) as [ActionType, typeof ACTION_CONFIG[ActionType]][]).map(
              ([action, config]) => {
                const names = grouped[action];
                if (names.length === 0) return null;

                return (
                  <span key={action} className={cn('inline-flex items-center gap-1', config.textColor)}>
                    <config.icon className="h-3.5 w-3.5" />
                    <span className="font-medium">{config.label}:</span>
                    <span>{names.join(', ')}</span>
                  </span>
                );
              },
            )}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
          aria-label="알림 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

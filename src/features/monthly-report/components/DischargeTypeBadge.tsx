'use client';

import { Badge } from '@/components/ui/badge';
import { match } from 'ts-pattern';
import { DISCHARGE_TYPE_LABELS } from '../constants/labels';
import type { DischargeEntry } from '../lib/dto';

interface DischargeTypeBadgeProps {
  type: DischargeEntry['type'];
}

export function DischargeTypeBadge({ type }: DischargeTypeBadgeProps) {
  const variant = match(type)
    .with('ward_admission', () => 'default' as const)
    .with('activity_stop', () => 'secondary' as const)
    .exhaustive();

  return (
    <Badge variant={variant}>
      {DISCHARGE_TYPE_LABELS[type]}
    </Badge>
  );
}

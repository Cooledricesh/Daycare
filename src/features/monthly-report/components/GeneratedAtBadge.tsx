'use client';

import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { GENERATED_BY_LABELS } from '../constants/labels';

interface GeneratedAtBadgeProps {
  generatedAt: string;
  generatedBy: 'cron' | 'manual';
}

export function GeneratedAtBadge({ generatedAt, generatedBy }: GeneratedAtBadgeProps) {
  const formattedDate = format(parseISO(generatedAt), 'MM/dd HH:mm', { locale: ko });

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs text-gray-500">
        {GENERATED_BY_LABELS[generatedBy]}
      </Badge>
      <span className="text-xs text-gray-400">{formattedDate} 기준</span>
    </div>
  );
}

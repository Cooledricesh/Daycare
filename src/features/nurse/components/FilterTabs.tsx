'use client';

import { Button } from '@/components/ui/button';

type FilterTabsProps = {
  value: 'all' | 'pending' | 'completed';
  onChange: (value: 'all' | 'pending' | 'completed') => void;
};

export function FilterTabs({ value, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-2 mb-4">
      <Button
        variant={value === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('all')}
      >
        전체
      </Button>
      <Button
        variant={value === 'pending' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('pending')}
      >
        미처리
      </Button>
      <Button
        variant={value === 'completed' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('completed')}
      >
        완료
      </Button>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMonthlyReportList } from '../hooks/useMonthlyReportList';

interface MonthSelectorProps {
  year: number;
  month: number;
}

export function MonthSelector({ year, month }: MonthSelectorProps) {
  const router = useRouter();
  const { data: list } = useMonthlyReportList();

  const currentValue = `${year}-${month}`;

  const handleChange = (value: string) => {
    const [y, m] = value.split('-');
    router.push(`/dashboard/admin/monthly-report?year=${y}&month=${m}`);
  };

  if (!list || list.length === 0) {
    return (
      <span className="text-sm text-gray-500">
        {year}년 {month}월
      </span>
    );
  }

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="월 선택" />
      </SelectTrigger>
      <SelectContent>
        {list.map((item) => (
          <SelectItem key={`${item.year}-${item.month}`} value={`${item.year}-${item.month}`}>
            {item.year}년 {item.month}월
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

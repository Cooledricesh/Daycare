'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PrescriptionCard } from '@/features/nurse/components/PrescriptionCard';
import { FilterTabs } from '@/features/nurse/components/FilterTabs';
import { usePrescriptions } from '@/features/nurse/hooks/usePrescriptions';

export default function NursePrescriptionsPage() {
  const today = new Date().toISOString().split('T')[0];
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const { data, isLoading, error } = usePrescriptions({ date: today, filter });

  const prescriptions = data?.prescriptions || [];

  const stats = {
    total: prescriptions.length,
    completed: prescriptions.filter((p) => p.is_completed).length,
    pending: prescriptions.filter((p) => !p.is_completed).length,
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">데이터를 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">처방 변경 관리</h1>
        <p className="text-gray-600">
          {format(new Date(), 'yyyy.MM.dd EEEE', { locale: ko })}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>오늘 진료 기록 ({stats.total}건)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {stats.pending}
              </div>
              <div className="text-sm text-gray-600">미처리</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
              <div className="text-sm text-gray-600">완료</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <FilterTabs value={filter} onChange={setFilter} />

      <div>
        {isLoading && (
          <div className="text-center py-8">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        )}

        {!isLoading && prescriptions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {filter === 'pending' && '미처리 건이 없습니다.'}
              {filter === 'completed' && '완료 건이 없습니다.'}
              {filter === 'all' && '처방 변경 건이 없습니다.'}
            </p>
          </div>
        )}

        {!isLoading &&
          prescriptions.map((prescription) => (
            <PrescriptionCard
              key={prescription.consultation_id}
              prescription={prescription}
            />
          ))}
      </div>
    </div>
  );
}

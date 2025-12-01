'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PatientCard } from '@/features/staff/components/PatientCard';
import { useMyPatients } from '@/features/staff/hooks/useMyPatients';

export default function StaffDashboardPage() {
  const today = new Date().toISOString().split('T')[0];
  const { data, isLoading, error } = useMyPatients({ date: today });

  const patients = data?.patients || [];

  const stats = {
    total: patients.length,
    attended: patients.filter((p) => p.is_attended).length,
    consulted: patients.filter((p) => p.is_consulted).length,
    hasTasks: patients.filter((p) => p.has_task && !p.task_completed).length,
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">데이터를 불러오는데 실패했습니다.</p>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">담당 환자 관리</h1>
        <p className="text-gray-600">
          {format(new Date(), 'yyyy.MM.dd EEEE', { locale: ko })}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>내 담당 환자 ({stats.total}명)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.attended}
              </div>
              <div className="text-sm text-gray-600">출석</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {stats.consulted}
              </div>
              <div className="text-sm text-gray-600">진찰</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {stats.hasTasks}
              </div>
              <div className="text-sm text-gray-600">🔔 지시</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">환자 목록</h2>

        {isLoading && (
          <div className="text-center py-8">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        )}

        {!isLoading && patients.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">담당 환자가 없습니다.</p>
          </div>
        )}

        {!isLoading &&
          patients.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
      </div>
    </div>
  );
}

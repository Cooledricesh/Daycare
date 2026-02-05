'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PatientCard } from '@/features/staff/components/PatientCard';
import { useMyPatients } from '@/features/staff/hooks/useMyPatients';
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

export default function StaffPatientsPage() {
  const today = new Date().toISOString().split('T')[0];
  const { data, isLoading, error } = useMyPatients({ date: today });
  const [searchTerm, setSearchTerm] = useState('');

  const patients = data?.patients || [];

  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return patients;
    return patients.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [patients, searchTerm]);

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
        <h1 className="text-2xl font-bold mb-1">담당 환자</h1>
        <p className="text-gray-600">
          {format(new Date(), 'yyyy.MM.dd EEEE', { locale: ko })}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
              <div className="text-sm text-gray-600">전체</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.attended}</div>
              <div className="text-sm text-gray-600">출석</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.consulted}</div>
              <div className="text-sm text-gray-600">진찰</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{stats.hasTasks}</div>
              <div className="text-sm text-gray-600">지시</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="환자 이름 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      )}

      {!isLoading && filteredPatients.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            {searchTerm ? '검색 결과가 없습니다.' : '담당 환자가 없습니다.'}
          </p>
        </div>
      )}

      {!isLoading && filteredPatients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredPatients.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}
    </div>
  );
}

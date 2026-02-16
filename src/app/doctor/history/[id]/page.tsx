'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { usePatientHistory } from '@/features/doctor/hooks/usePatientHistory';
import { PatientHistoryCard } from '@/features/doctor/components/PatientHistoryCard';
import { ConsultationHistory } from '@/features/doctor/components/ConsultationHistory';
import { MessageHistory } from '@/features/doctor/components/MessageHistory';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DoctorHistoryPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { data: history, isLoading, error } = usePatientHistory({
    patientId: resolvedParams.id,
    months: 24,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">로딩 중...</div>
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로가기
        </Button>
        <div className="text-center py-8 text-red-500">
          환자 정보를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="text-2xl font-bold">환자 히스토리</h1>
        </div>
      </div>

      <div className="space-y-6">
        <PatientHistoryCard patient={history.patient} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ConsultationHistory consultations={history.consultations} />
          <MessageHistory messages={history.messages} />
        </div>
      </div>
    </div>
  );
}

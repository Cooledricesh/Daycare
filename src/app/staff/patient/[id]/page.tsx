'use client';

import { use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePatientDetail } from '@/features/staff/hooks/usePatientDetail';
import { TaskCompletionButton } from '@/features/staff/components/TaskCompletionButton';
import { MessageForm } from '@/features/staff/components/MessageForm';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function StaffPatientDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const patientId = resolvedParams.id;
  const today = new Date().toISOString().split('T')[0];

  const { data, isLoading, error } = usePatientDetail({
    patientId,
    date: today,
  });

  const patient = data?.patient;

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">데이터를 불러오는데 실패했습니다.</p>
        <Link href="/staff/dashboard">
          <Button variant="outline" className="mt-4">
            돌아가기
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading || !patient) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/staff/dashboard">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{patient.name}</h1>
        {patient.birth_date && patient.gender && (
          <p className="text-gray-600">
            {format(new Date(patient.birth_date), 'yyyy.MM.dd', {
              locale: ko,
            })}{' '}
            ({patient.gender === 'M' ? '남' : '여'})
          </p>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>오늘 상태</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">출석</span>
            <div className="flex items-center gap-2">
              <Badge variant={patient.attendance.is_attended ? 'default' : 'secondary'}>
                {patient.attendance.is_attended ? '✓' : '✗'}
              </Badge>
              {patient.attendance.checked_at && (
                <span className="text-sm text-gray-500">
                  {format(new Date(patient.attendance.checked_at), 'HH:mm', {
                    locale: ko,
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">진찰</span>
            <Badge variant={patient.consultation.is_consulted ? 'default' : 'secondary'}>
              {patient.consultation.is_consulted ? '✓' : '⏳'}
            </Badge>
          </div>

          {patient.vitals && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">혈압</span>
                  <span>
                    {patient.vitals.systolic || '-'}/{patient.vitals.diastolic || '-'} mmHg
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">혈당</span>
                  <span>{patient.vitals.blood_sugar || '-'} mg/dL</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {patient.consultation.has_task && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔔 지시사항
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-800">
              {patient.consultation.task_content || '-'}
            </p>

            {patient.consultation.consultation_id && (
              <TaskCompletionButton
                consultationId={patient.consultation.consultation_id}
                isCompleted={patient.consultation.is_task_completed}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>의사에게 전달사항</CardTitle>
        </CardHeader>
        <CardContent>
          <MessageForm patientId={patientId} date={today} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>최근 기록</CardTitle>
        </CardHeader>
        <CardContent>
          {patient.recent_consultations.length === 0 ? (
            <p className="text-gray-500 text-sm">최근 기록이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {patient.recent_consultations.map((record, index) => (
                <div key={index} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {format(new Date(record.date), 'MM/dd (EEE)', {
                        locale: ko,
                      })}
                    </span>
                    <span className="text-xs text-gray-500">
                      {record.doctor_name}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {record.note || '기록 없음'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

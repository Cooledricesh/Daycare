'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useNursePatientDetail } from '@/features/nurse/hooks/useNursePatientDetail';
import { useNursePatientHistory } from '@/features/nurse/hooks/useNursePatientHistory';
import { useCompleteTask } from '@/features/nurse/hooks/useCompleteTask';
import { NurseMessageForm } from '@/features/nurse/components/NurseMessageForm';
import { ConsultationHistory } from '@/features/doctor/components/ConsultationHistory';
import { useToast } from '@/hooks/use-toast';
import { getTodayString } from '@/lib/date';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function NursePatientDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const patientId = resolvedParams.id;
  const today = getTodayString();
  const [showFullHistory, setShowFullHistory] = useState(false);

  const { data, isLoading, error } = useNursePatientDetail({
    patientId,
    date: today,
  });

  const { data: historyData, isLoading: historyLoading } = useNursePatientHistory({
    patientId,
    months: 24,
    enabled: showFullHistory,
  });

  const { mutate: completeTask, isPending: isCompleting } = useCompleteTask();
  const { toast } = useToast();

  const patient = data?.patient;

  const handleTaskComplete = (value: boolean | 'indeterminate') => {
    if (value === true && patient?.consultation.consultation_id) {
      completeTask(
        { consultationId: patient.consultation.consultation_id },
        {
          onSuccess: () => {
            toast({ title: '처리 완료', description: '지시사항이 처리 완료되었습니다.' });
          },
          onError: () => {
            toast({ title: '처리 실패', description: '다시 시도해주세요.', variant: 'destructive' });
          },
        },
      );
    }
  };

  // 간호사 대상 지시사항 여부
  const hasNurseTask = patient?.consultation.has_task &&
    (patient?.consultation.task_target === 'nurse' || patient?.consultation.task_target === 'both');

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">데이터를 불러오는데 실패했습니다.</p>
        <Link href="/nurse/prescriptions">
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
        <Link href="/nurse/prescriptions">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{patient.name}</h1>
        {patient.gender && (
          <p className="text-gray-600">
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
                {patient.attendance.is_attended ? '출석' : '미출석'}
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
              {patient.consultation.is_consulted ? '완료' : '대기'}
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

      {hasNurseTask && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>간호 지시사항</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-800">
              {patient.consultation.task_content || '-'}
            </p>

            {patient.consultation.consultation_id && !patient.consultation.is_task_completed && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="nurse-task-detail"
                  onCheckedChange={handleTaskComplete}
                  disabled={isCompleting}
                />
                <label htmlFor="nurse-task-detail" className="text-sm font-medium leading-none">
                  처리 완료
                </label>
              </div>
            )}

            {patient.consultation.is_task_completed && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                처리 완료
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>의사에게 전달사항</CardTitle>
        </CardHeader>
        <CardContent>
          <NurseMessageForm patientId={patientId} date={today} />
        </CardContent>
      </Card>

      {!showFullHistory ? (
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

            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-4 text-gray-500"
              onClick={() => setShowFullHistory(true)}
            >
              <ChevronDown className="w-4 h-4 mr-1" />
              전체 기록 보기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500"
              onClick={() => setShowFullHistory(false)}
            >
              <ChevronUp className="w-4 h-4 mr-1" />
              간략히 보기
            </Button>
          </div>

          {historyLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                기록을 불러오는 중...
              </CardContent>
            </Card>
          ) : historyData ? (
            <ConsultationHistory consultations={historyData.consultations} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                기록을 불러올 수 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

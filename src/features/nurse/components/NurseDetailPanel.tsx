'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNursePatientDetail } from '../hooks/useNursePatientDetail';
import { useNursePatientHistory } from '../hooks/useNursePatientHistory';
import { useCompleteTask } from '../hooks/useCompleteTask';
import { useNurseDeleteMessage } from '../hooks/useNurseDeleteMessage';
import { extractApiErrorMessage } from '@/lib/remote/api-client';
import { NurseMessageForm } from './NurseMessageForm';
import { ConsultationHistory } from '@/features/doctor/components/ConsultationHistory';
import { getTodayString } from '@/lib/date';
import type { NursePatientSummary } from '../backend/schema';

interface NurseDetailPanelProps {
  patient: NursePatientSummary | null;
}

export function NurseDetailPanel({ patient }: NurseDetailPanelProps) {
  const today = getTodayString();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: detailData, isLoading: detailLoading } = useNursePatientDetail({
    patientId: patient?.id || '',
    date: today,
    enabled: !!patient,
  });

  const { data: historyData, isLoading: historyLoading } = useNursePatientHistory({
    patientId: patient?.id || '',
    months: 3,
    enabled: !!patient,
  });

  const { mutate: completeTask, isPending: isCompleting } = useCompleteTask();
  const { mutate: deleteMessageMutate } = useNurseDeleteMessage();

  const handleDeleteMessage = (messageId: string) => {
    deleteMessageMutate(messageId, {
      onSuccess: () => {
        toast({ title: '삭제 완료', description: '전달사항이 삭제되었습니다.' });
      },
      onError: (error) => {
        const message = extractApiErrorMessage(error, '삭제에 실패했습니다.');
        toast({ title: '삭제 실패', description: message, variant: 'destructive' });
      },
    });
  };

  // 환자 미선택 시 안내
  if (!patient) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <Stethoscope className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">환자를 선택해주세요</p>
          <p className="text-sm mt-1">왼쪽 목록에서 환자를 클릭하면 상세 정보를 확인할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const detail = detailData?.patient;

  const hasNurseTask = !!detail?.consultation.has_task;

  const handleTaskComplete = (value: boolean | 'indeterminate') => {
    if (value === true && detail?.consultation.consultation_id) {
      completeTask(
        { consultationId: detail.consultation.consultation_id },
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

  return (
    <div className="p-6 space-y-5 max-w-3xl overflow-y-auto h-full">
      {/* 환자 정보 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <User className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{patient.name}</h2>
            {patient.is_consulted && (
              <Badge className="bg-green-100 text-green-700 text-xs">진찰 완료</Badge>
            )}
            {patient.has_nurse_task && !patient.task_completed && (
              <Badge className="bg-orange-100 text-orange-700 text-xs">지시 미처리</Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {patient.is_attended
              ? `${patient.attendance_time ? format(new Date(patient.attendance_time), 'HH:mm', { locale: ko }) + ' ' : ''}출석`
              : '미출석'}
            {patient.doctor_name && ` · 담당의: ${patient.doctor_name}`}
          </p>
        </div>
      </div>

      {/* 활력징후 */}
      {detailLoading ? (
        <p className="text-sm text-gray-400">상세 정보 로딩 중...</p>
      ) : detail?.vitals && (
        <div className="flex gap-2">
          {detail.vitals.systolic && detail.vitals.diastolic && (
            <Badge variant="outline">
              혈압 {detail.vitals.systolic}/{detail.vitals.diastolic}
            </Badge>
          )}
          {detail.vitals.blood_sugar && (
            <Badge variant="outline">
              혈당 {detail.vitals.blood_sugar}
            </Badge>
          )}
        </div>
      )}

      {/* 진찰 메모 */}
      {patient.note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">진찰 메모</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{patient.note}</p>
          </CardContent>
        </Card>
      )}

      {/* 간호 지시사항 */}
      {hasNurseTask && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-700">투약 변경 및 전달사항</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-800">{detail?.consultation.task_content || '-'}</p>

            {detail?.consultation.consultation_id && !detail?.consultation.is_task_completed ? (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="nurse-task-panel"
                  onCheckedChange={handleTaskComplete}
                  disabled={isCompleting}
                />
                <label htmlFor="nurse-task-panel" className="text-sm font-medium leading-none">
                  처리 완료
                </label>
              </div>
            ) : (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                처리 완료
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* 전달사항 작성 */}
      <Card className="border-emerald-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">주치의에게 전달사항</CardTitle>
        </CardHeader>
        <CardContent>
          <NurseMessageForm patientId={patient.id} date={today} />
        </CardContent>
      </Card>

      {/* 기록 */}
      {historyLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            기록을 불러오는 중...
          </CardContent>
        </Card>
      ) : historyData && (historyData.consultations.length > 0 || (historyData.messages && historyData.messages.length > 0)) ? (
        <ConsultationHistory
          consultations={historyData.consultations}
          messages={historyData.messages}
          currentUserId={user?.id}
          currentUserRole={user?.role}
          onDeleteMessage={handleDeleteMessage}
        />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            기록이 없습니다.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

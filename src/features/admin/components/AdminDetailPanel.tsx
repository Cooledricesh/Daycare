'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { LayoutDashboard } from 'lucide-react';
import { PatientAvatar } from '@/features/shared/components/PatientAvatar';
import { DisplayNameEditButton } from '@/features/shared/components/DisplayNameEditButton';
import { getPatientDisplayName } from '@/lib/patient';
import { calculateKoreanAge } from '@/lib/birthday';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { getTodayString } from '@/lib/date';
import { useAdminPatientDetail, useAdminPatientHistory, useAdminCompleteTask, useAdminDeleteMessage, useAdminUpdateMessage, useAdminDeleteConsultation } from '../hooks/useDashboard';
import { extractApiErrorMessage } from '@/lib/remote/api-client';
import { AdminMessageForm } from './AdminMessageForm';
import { ConsultationHistory } from '@/features/doctor/components/ConsultationHistory';
import { AttendanceCalendar } from '@/features/shared/components/AttendanceCalendar';
import type { NursePatientSummary } from '@/features/nurse/backend/schema';

interface AdminDetailPanelProps {
  patient: NursePatientSummary | null;
}

export function AdminDetailPanel({ patient }: AdminDetailPanelProps) {
  const today = getTodayString();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: detailData, isLoading: detailLoading } = useAdminPatientDetail({
    patientId: patient?.id || '',
    date: today,
    enabled: !!patient,
  });

  const { data: historyData, isLoading: historyLoading } = useAdminPatientHistory({
    patientId: patient?.id || '',
    months: 3,
    enabled: !!patient,
  });

  const { mutate: completeTask, isPending: isCompleting } = useAdminCompleteTask();
  const { mutate: deleteMessageMutate } = useAdminDeleteMessage();
  const { mutate: updateMessageMutate } = useAdminUpdateMessage();
  const { mutate: deleteConsultationMutate } = useAdminDeleteConsultation();

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

  const handleEditMessage = (messageId: string, newContent: string) => {
    updateMessageMutate({ messageId, content: newContent }, {
      onSuccess: () => {
        toast({ title: '수정 완료', description: '전달사항이 수정되었습니다.' });
      },
      onError: (error) => {
        const message = extractApiErrorMessage(error, '수정에 실패했습니다.');
        toast({ title: '수정 실패', description: message, variant: 'destructive' });
      },
    });
  };

  const handleDeleteConsultation = (consultationId: string) => {
    deleteConsultationMutate(consultationId, {
      onSuccess: () => {
        toast({ title: '삭제 완료', description: '진찰 기록이 삭제되었습니다.' });
      },
      onError: (error) => {
        const message = extractApiErrorMessage(error, '삭제에 실패했습니다.');
        toast({ title: '삭제 실패', description: message, variant: 'destructive' });
      },
    });
  };

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <LayoutDashboard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">환자를 선택해주세요</p>
          <p className="text-sm mt-1">왼쪽 목록에서 환자를 클릭하면 상세 정보를 확인할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const detail = detailData?.patient;

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
    <div className="p-6 h-full">
      {/* 환자 정보 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <PatientAvatar avatarUrl={patient.avatar_url} size="lg" fallbackColorClass="bg-indigo-100" iconColorClass="text-indigo-600" />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{getPatientDisplayName(patient)}</h2>
            <DisplayNameEditButton
              patientId={patient.id}
              patientName={patient.name}
              currentDisplayName={patient.display_name}
              currentAvatarUrl={patient.avatar_url}
            />
            {calculateKoreanAge(patient.birth_date) !== null && (
              <Badge variant="outline" className="text-xs">
                만 {calculateKoreanAge(patient.birth_date)}세
              </Badge>
            )}
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
              : patient.is_scheduled
                ? '미출석 (예정)'
                : '미출석'}
            {patient.doctor_name && ` · 담당의: ${patient.doctor_name}`}
          </p>
        </div>
      </div>

      {/* 2컬럼 레이아웃: 좌(작업) / 우(캘린더+히스토리) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 좌측: 바이탈 + 진찰메모 + 지시사항 + 전달사항 */}
        <div className="space-y-4">
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

          {/* 지시사항 */}
          {detail?.consultation.has_task && (
            <Card className="border-orange-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-orange-700">투약 변경 및 전달사항</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-800">{detail.consultation.task_content || '-'}</p>

                {detail.consultation.consultation_id && !detail.consultation.is_task_completed ? (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="admin-task-panel"
                      onCheckedChange={handleTaskComplete}
                      disabled={isCompleting}
                    />
                    <label htmlFor="admin-task-panel" className="text-sm font-medium leading-none">
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
          <Card className="border-indigo-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">주치의에게 전달사항</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminMessageForm patientId={patient.id} date={today} />
            </CardContent>
          </Card>

          {/* 출석 캘린더 */}
          <AttendanceCalendar patientId={patient.id} birthDate={patient.birth_date} />
        </div>

        {/* 우측: 히스토리 */}
        <div className="lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
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
              onDeleteConsultation={handleDeleteConsultation}
              onEditMessage={handleEditMessage}
              todayDate={today}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                기록이 없습니다.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

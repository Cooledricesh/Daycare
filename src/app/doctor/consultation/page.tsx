'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RefreshCw, User, Stethoscope, CheckCircle2, MessageSquare } from 'lucide-react';
import { useWaitingPatients } from '@/features/doctor/hooks/useWaitingPatients';
import { useCreateConsultation } from '@/features/doctor/hooks/useCreateConsultation';
import { usePatientMessages } from '@/features/doctor/hooks/usePatientMessages';
import type { WaitingPatient } from '@/features/doctor/backend/schema';

export default function DoctorConsultationPage() {
  const { data: patients, isLoading, error, refetch } = useWaitingPatients();
  const createConsultation = useCreateConsultation();

  const [selectedPatient, setSelectedPatient] = useState<WaitingPatient | null>(null);
  const [consultationNote, setConsultationNote] = useState('');
  const [hasTask, setHasTask] = useState(false);
  const [taskContent, setTaskContent] = useState('');
  const [taskTarget, setTaskTarget] = useState<'coordinator' | 'nurse' | 'both'>('coordinator');

  // 선택된 환자의 메시지 조회
  const { data: messages, isLoading: messagesLoading } = usePatientMessages({
    patientId: selectedPatient?.id || null,
  });

  const handleOpenConsultation = (patient: WaitingPatient) => {
    setSelectedPatient(patient);
    setConsultationNote('');
    setHasTask(false);
    setTaskContent('');
    setTaskTarget('coordinator');
  };

  const handleCloseConsultation = () => {
    setSelectedPatient(null);
  };

  const handleSubmitConsultation = async () => {
    if (!selectedPatient) return;

    await createConsultation.mutateAsync({
      patient_id: selectedPatient.id,
      note: consultationNote || undefined,
      has_task: hasTask,
      task_content: hasTask ? taskContent : undefined,
      task_target: hasTask ? taskTarget : undefined,
    });

    handleCloseConsultation();
  };

  // 대기중인 환자와 진찰 완료 환자 분리
  const waitingPatients = patients?.filter(p => !p.has_consultation) || [];
  const completedPatients = patients?.filter(p => p.has_consultation) || [];

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">진료실</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              전체 출석
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{patients?.length || 0}명</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">
              대기중
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {waitingPatients.length}명
            </p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              진찰 완료
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {completedPatients.length}명
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">환자 목록을 불러오는데 실패했습니다.</p>
          </CardContent>
        </Card>
      )}

      {/* 대기 환자 목록 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            대기 환자 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">로딩 중...</p>
          ) : waitingPatients.length === 0 ? (
            <p className="text-gray-500 text-center py-8">대기 중인 환자가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {waitingPatients.map((patient) => (
                <div
                  key={patient.id}
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${
                    !patient.checked_at ? 'border-yellow-300 bg-yellow-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {patient.name}
                          <span className="text-gray-500 text-sm ml-2">
                            {patient.gender === 'M' ? '남' : patient.gender === 'F' ? '여' : ''}
                          </span>
                        </p>
                        {patient.checked_at ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                            출석
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-xs">
                            미출석
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {patient.room_number ? `${patient.room_number}호` : '-'}
                        {patient.coordinator_name && ` · 담당: ${patient.coordinator_name}`}
                      </p>
                    </div>
                    {patient.vitals && (
                      <div className="flex gap-2">
                        {patient.vitals.systolic && patient.vitals.diastolic && (
                          <Badge variant="outline">
                            혈압 {patient.vitals.systolic}/{patient.vitals.diastolic}
                          </Badge>
                        )}
                        {patient.vitals.blood_sugar && (
                          <Badge variant="outline">
                            혈당 {patient.vitals.blood_sugar}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleOpenConsultation(patient)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Stethoscope className="w-4 h-4 mr-2" />
                    진찰
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 진찰 완료 환자 목록 */}
      {completedPatients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              진찰 완료
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-600">
                      {patient.name}
                      <span className="text-gray-400 text-sm ml-2">
                        {patient.gender === 'M' ? '남' : patient.gender === 'F' ? '여' : ''}
                      </span>
                    </p>
                    <p className="text-sm text-gray-400">
                      {patient.room_number ? `${patient.room_number}호` : '-'}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    완료
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 진찰 다이얼로그 */}
      <Dialog open={!!selectedPatient} onOpenChange={() => handleCloseConsultation()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPatient?.name} 환자 진찰
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 환자 정보 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                {selectedPatient?.room_number ? `${selectedPatient.room_number}호` : '-'}
                {selectedPatient?.coordinator_name && ` · 담당: ${selectedPatient.coordinator_name}`}
              </p>
              {selectedPatient?.vitals && (
                <div className="flex gap-2 mt-2">
                  {selectedPatient.vitals.systolic && selectedPatient.vitals.diastolic && (
                    <Badge variant="outline">
                      혈압 {selectedPatient.vitals.systolic}/{selectedPatient.vitals.diastolic}
                    </Badge>
                  )}
                  {selectedPatient.vitals.blood_sugar && (
                    <Badge variant="outline">
                      혈당 {selectedPatient.vitals.blood_sugar}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* 직원 전달사항 */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-700">직원 전달사항</span>
              </div>
              {messagesLoading ? (
                <p className="text-sm text-gray-500">로딩 중...</p>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-white p-2 rounded border border-blue-100">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <span className="font-medium">{msg.author_name}</span>
                        <span>({msg.author_role === 'coordinator' ? '코디네이터' : '간호사'})</span>
                        <span>·</span>
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">오늘 전달사항이 없습니다.</p>
              )}
            </div>

            {/* 진찰 메모 */}
            <div>
              <Label htmlFor="note">진찰 메모</Label>
              <Textarea
                id="note"
                placeholder="진찰 내용을 입력하세요..."
                value={consultationNote}
                onChange={(e) => setConsultationNote(e.target.value)}
                className="mt-1"
                rows={4}
              />
            </div>

            {/* 지시사항 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasTask"
                  checked={hasTask}
                  onCheckedChange={(checked) => setHasTask(!!checked)}
                />
                <Label htmlFor="hasTask">지시사항 추가</Label>
              </div>

              {hasTask && (
                <>
                  <Textarea
                    placeholder="지시사항 내용을 입력하세요..."
                    value={taskContent}
                    onChange={(e) => setTaskContent(e.target.value)}
                    rows={2}
                  />
                  <div>
                    <Label className="mb-2 block">지시 대상</Label>
                    <RadioGroup
                      value={taskTarget}
                      onValueChange={(value) => setTaskTarget(value as typeof taskTarget)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="coordinator" id="coordinator" />
                        <Label htmlFor="coordinator">코디네이터</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="nurse" id="nurse" />
                        <Label htmlFor="nurse">간호사</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="both" id="both" />
                        <Label htmlFor="both">모두</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseConsultation}>
              취소
            </Button>
            <Button
              onClick={handleSubmitConsultation}
              disabled={createConsultation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createConsultation.isPending ? '저장 중...' : '진찰 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

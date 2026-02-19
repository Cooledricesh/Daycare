'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Stethoscope,
  MessageSquare,
  History,
  User,
  CheckCircle2,
} from 'lucide-react';
import { useCreateConsultation } from '../hooks/useCreateConsultation';
import { usePatientMessages } from '../hooks/usePatientMessages';
import { usePatientHistory } from '../hooks/usePatientHistory';
import { ConsultationHistory } from './ConsultationHistory';
import type { WaitingPatient } from '../backend/schema';

interface ConsultationPanelProps {
  patient: WaitingPatient | null;
  onConsultationComplete: () => void;
}

export function ConsultationPanel({ patient, onConsultationComplete }: ConsultationPanelProps) {
  const [consultationNote, setConsultationNote] = useState('');
  const [hasTask, setHasTask] = useState(false);
  const [taskContent, setTaskContent] = useState('');
  const [taskTarget, setTaskTarget] = useState<'coordinator' | 'nurse' | 'both'>('coordinator');

  const createConsultation = useCreateConsultation();

  // 선택된 환자의 오늘 전달사항
  const { data: messages, isLoading: messagesLoading } = usePatientMessages({
    patientId: patient?.id || null,
  });

  // 선택된 환자의 최근 히스토리 (3개월)
  const { data: history, isLoading: historyLoading } = usePatientHistory({
    patientId: patient?.id || '',
    months: 3,
  });

  const resetForm = () => {
    setConsultationNote('');
    setHasTask(false);
    setTaskContent('');
    setTaskTarget('coordinator');
  };

  const handleSubmit = async () => {
    if (!patient) return;

    await createConsultation.mutateAsync({
      patient_id: patient.id,
      note: consultationNote || undefined,
      has_task: hasTask,
      task_content: hasTask ? taskContent : undefined,
      task_target: hasTask ? taskTarget : undefined,
    });

    resetForm();
    onConsultationComplete();
  };

  // 환자 미선택 시 안내
  if (!patient) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <Stethoscope className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">환자를 선택해주세요</p>
          <p className="text-sm mt-1">왼쪽 목록에서 환자를 클릭하면 진찰을 시작할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      {/* 환자 정보 헤더 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <User className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{patient.name}</h2>
              {patient.gender && (
                <Badge variant="outline" className="text-xs">
                  {patient.gender === 'M' ? '남' : '여'}
                </Badge>
              )}
              {patient.has_consultation && (
                <Badge className="bg-green-100 text-green-700 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  진찰 완료
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {patient.room_number ? `${patient.room_number}호` : '-'}
              {patient.coordinator_name && ` · 담당: ${patient.coordinator_name}`}
            </p>
          </div>
        </div>
        <Link href={`/doctor/history/${patient.id}`}>
          <Button variant="outline" size="sm">
            <History className="w-4 h-4 mr-1" />
            전체 히스토리
          </Button>
        </Link>
      </div>

      {/* 활력징후 */}
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

      {/* 오늘 전달사항 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            오늘 전달사항
            {messages && messages.length > 0 && (
              <Badge variant="secondary" className="text-xs">{messages.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messagesLoading ? (
            <p className="text-sm text-gray-500">로딩 중...</p>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className="p-2 bg-blue-50 rounded border border-blue-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <span className="font-medium">{msg.author_name}</span>
                    <span>({msg.author_role === 'coordinator' ? '코디' : '간호사'})</span>
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
            <p className="text-sm text-gray-400">오늘 전달사항이 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 진찰 폼 */}
      <Card className="border-purple-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-purple-600" />
            진찰 기록 작성
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 진찰 메모 */}
          <div>
            <Label htmlFor="note" className="text-sm">진찰 메모</Label>
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
              <Label htmlFor="hasTask" className="text-sm">지시사항 추가</Label>
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
                  <Label className="mb-2 block text-sm">지시 대상</Label>
                  <RadioGroup
                    value={taskTarget}
                    onValueChange={(value) => setTaskTarget(value as typeof taskTarget)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="coordinator" id="target-coordinator" />
                      <Label htmlFor="target-coordinator" className="text-sm">코디네이터</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="nurse" id="target-nurse" />
                      <Label htmlFor="target-nurse" className="text-sm">간호사</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="both" id="target-both" />
                      <Label htmlFor="target-both" className="text-sm">모두</Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}
          </div>

          {/* 제출 버튼 */}
          <Button
            onClick={handleSubmit}
            disabled={createConsultation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {createConsultation.isPending ? '저장 중...' : '진찰 완료'}
          </Button>
        </CardContent>
      </Card>

      {/* 최근 히스토리 */}
      {historyLoading ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500 text-center">히스토리 로딩 중...</p>
          </CardContent>
        </Card>
      ) : history && history.consultations.length > 0 ? (
        <ConsultationHistory consultations={history.consultations} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">최근 진찰 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 text-center">최근 3개월 내 기록이 없습니다.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

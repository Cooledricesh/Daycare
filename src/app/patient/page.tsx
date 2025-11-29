'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { PatientSearchSection } from '@/features/patient/components/PatientSearchSection';
import { ConfirmationModal } from '@/features/patient/components/ConfirmationModal';
import { VitalsInputSection } from '@/features/patient/components/VitalsInputSection';
import { CompletionScreen } from '@/features/patient/components/CompletionScreen';
import { useCreateAttendance } from '@/features/patient/hooks/useCreateAttendance';
import { useCreateVitals } from '@/features/patient/hooks/useCreateVitals';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/features/patient/backend/schema';

type Step = 'search' | 'confirm' | 'vitals' | 'complete';

interface VitalsInput {
  systolic: string;
  diastolic: string;
  blood_sugar: string;
}

export default function PatientPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('search');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [attendanceTime, setAttendanceTime] = useState('');
  const [vitalsInput, setVitalsInput] = useState<VitalsInput>({
    systolic: '',
    diastolic: '',
    blood_sugar: '',
  });

  const createAttendance = useCreateAttendance();
  const createVitals = useCreateVitals();

  // 환자 선택 → 확인 모달 표시
  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setStep('confirm');
  };

  // 출석 확인 취소
  const handleConfirmCancel = () => {
    setSelectedPatient(null);
    setStep('search');
  };

  // 출석 확인
  const handleConfirm = async () => {
    if (!selectedPatient) return;

    try {
      const attendance = await createAttendance.mutateAsync({
        patient_id: selectedPatient.id,
        date: format(new Date(), 'yyyy-MM-dd'),
      });

      setAttendanceTime(
        new Date(attendance.checked_at).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );

      setStep('vitals');
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast({
          title: '출석 체크 실패',
          description: error.message || '출석 체크에 실패했습니다. 다시 시도해주세요.',
          variant: 'destructive',
        });
      }
      // 오류 시 처음으로
      handleReset();
    }
  };

  // 활력징후 입력값 변경
  const handleVitalsInputChange = (
    field: 'systolic' | 'diastolic' | 'blood_sugar',
    value: string,
  ) => {
    setVitalsInput((prev) => ({ ...prev, [field]: value }));
  };

  // 활력징후 건너뛰기
  const handleSkip = () => {
    setStep('complete');
  };

  // 활력징후 저장
  const handleSave = async () => {
    if (!selectedPatient) return;

    try {
      await createVitals.mutateAsync({
        patient_id: selectedPatient.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        systolic: vitalsInput.systolic ? parseInt(vitalsInput.systolic, 10) : null,
        diastolic: vitalsInput.diastolic ? parseInt(vitalsInput.diastolic, 10) : null,
        blood_sugar: vitalsInput.blood_sugar ? parseInt(vitalsInput.blood_sugar, 10) : null,
      });

      setStep('complete');
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast({
          title: '활력징후 저장 실패',
          description: error.message || '활력징후 저장에 실패했습니다.',
          variant: 'destructive',
        });
      }
      // 오류 발생해도 완료 화면으로 이동 (선택사항이므로)
      setStep('complete');
    }
  };

  // 처음으로 리셋
  const handleReset = () => {
    setSelectedPatient(null);
    setAttendanceTime('');
    setVitalsInput({ systolic: '', diastolic: '', blood_sugar: '' });
    setStep('search');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      {step === 'search' && (
        <PatientSearchSection onPatientSelect={handlePatientSelect} />
      )}

      {step === 'confirm' && selectedPatient && (
        <ConfirmationModal
          patient={selectedPatient}
          isOpen={true}
          onCancel={handleConfirmCancel}
          onConfirm={handleConfirm}
          isLoading={createAttendance.isPending}
        />
      )}

      {step === 'vitals' && selectedPatient && (
        <VitalsInputSection
          patientName={selectedPatient.name}
          attendanceTime={attendanceTime}
          vitalsInput={vitalsInput}
          onVitalsInputChange={handleVitalsInputChange}
          onSkip={handleSkip}
          onSave={handleSave}
          isSaving={createVitals.isPending}
        />
      )}

      {step === 'complete' && selectedPatient && (
        <CompletionScreen
          patientName={selectedPatient.name}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

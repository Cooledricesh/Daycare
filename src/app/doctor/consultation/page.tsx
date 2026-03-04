'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWaitingPatients } from '@/features/doctor/hooks/useWaitingPatients';
import { PatientListPanel } from '@/features/doctor/components/PatientListPanel';
import { ConsultationPanel } from '@/features/doctor/components/ConsultationPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { WaitingPatient } from '@/features/doctor/backend/schema';

export default function DoctorConsultationPage() {
  const { data: patients, isLoading, refetch } = useWaitingPatients();
  const [selectedPatient, setSelectedPatient] = useState<WaitingPatient | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // 환자 선택
  const handleSelectPatient = useCallback((patient: WaitingPatient) => {
    setSelectedPatient(patient);
  }, []);

  // 진찰 완료 후: 선택된 환자의 상태를 갱신된 목록에서 다시 찾아 반영
  const handleConsultationComplete = useCallback(() => {
    // refetch가 완료되면 selectedPatient가 갱신된 데이터로 교체됨
  }, []);

  // 환자 목록이 갱신되면 선택된 환자도 갱신
  useEffect(() => {
    if (selectedPatient && patients) {
      const updated = patients.find(p => p.id === selectedPatient.id);
      if (updated) {
        setSelectedPatient(updated);
      }
    }
  }, [patients, selectedPatient]);

  // 환자 목록 탐색: 이전/다음
  const handleNavigatePrev = useCallback(() => {
    if (!patients || patients.length === 0) return;
    if (!selectedPatient) {
      setSelectedPatient(patients[patients.length - 1]);
      return;
    }
    const idx = patients.findIndex(p => p.id === selectedPatient.id);
    if (idx > 0) {
      setSelectedPatient(patients[idx - 1]);
    }
  }, [patients, selectedPatient]);

  const handleNavigateNext = useCallback(() => {
    if (!patients || patients.length === 0) return;
    if (!selectedPatient) {
      setSelectedPatient(patients[0]);
      return;
    }
    const idx = patients.findIndex(p => p.id === selectedPatient.id);
    if (idx < patients.length - 1) {
      setSelectedPatient(patients[idx + 1]);
    }
  }, [patients, selectedPatient]);

  // 키보드 단축키
  useKeyboardShortcuts({
    searchInputRef,
    onNavigatePrev: handleNavigatePrev,
    onNavigateNext: handleNavigateNext,
  });

  return (
    <MasterDetailLayout
      hasSelection={selectedPatient !== null}
      onBack={() => setSelectedPatient(null)}
      master={
        <PatientListPanel
          patients={patients || []}
          isLoading={isLoading}
          selectedPatientId={selectedPatient?.id || null}
          onSelectPatient={handleSelectPatient}
          onRefresh={() => refetch()}
          searchInputRef={searchInputRef}
        />
      }
      detail={
        <ConsultationPanel
          patient={selectedPatient}
          onConsultationComplete={handleConsultationComplete}
        />
      }
    />
  );
}

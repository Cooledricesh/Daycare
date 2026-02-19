'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWaitingPatients } from '@/features/doctor/hooks/useWaitingPatients';
import { PatientListPanel } from '@/features/doctor/components/PatientListPanel';
import { ConsultationPanel } from '@/features/doctor/components/ConsultationPanel';
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

  // 키보드 단축키: Ctrl+K 또는 / → 검색 포커스, Esc → 검색 해제
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 중일 때는 / 단축키 무시
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-full">
      {/* 왼쪽: 환자 목록 패널 */}
      <div className="w-[380px] border-r border-gray-200 flex-shrink-0">
        <PatientListPanel
          patients={patients || []}
          isLoading={isLoading}
          selectedPatientId={selectedPatient?.id || null}
          onSelectPatient={handleSelectPatient}
          onRefresh={() => refetch()}
          searchInputRef={searchInputRef}
        />
      </div>

      {/* 오른쪽: 진찰 상세 패널 */}
      <div className="flex-1 overflow-y-auto">
        <ConsultationPanel
          patient={selectedPatient}
          onConsultationComplete={handleConsultationComplete}
        />
      </div>
    </div>
  );
}

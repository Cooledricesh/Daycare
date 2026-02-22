'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNursePatients } from '@/features/nurse/hooks/useNursePatients';
import { NursePatientListPanel } from '@/features/nurse/components/NursePatientListPanel';
import { NurseDetailPanel } from '@/features/nurse/components/NurseDetailPanel';
import type { NursePatientSummary } from '@/features/nurse/backend/schema';

export default function NursePrescriptionsPage() {
  const today = new Date().toISOString().split('T')[0];
  const { data, isLoading, refetch } = useNursePatients({ date: today });
  const patients = data?.patients || [];

  const [selectedPatient, setSelectedPatient] = useState<NursePatientSummary | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectPatient = useCallback((patient: NursePatientSummary) => {
    setSelectedPatient(patient);
  }, []);

  // 환자 목록이 갱신되면 선택된 환자도 갱신
  useEffect(() => {
    if (selectedPatient && patients.length > 0) {
      const updated = patients.find(p => p.id === selectedPatient.id);
      if (updated) {
        setSelectedPatient(updated);
      }
    }
  }, [patients, selectedPatient]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        <NursePatientListPanel
          patients={patients}
          isLoading={isLoading}
          selectedPatientId={selectedPatient?.id || null}
          onSelectPatient={handleSelectPatient}
          onRefresh={() => refetch()}
          searchInputRef={searchInputRef}
        />
      </div>

      {/* 오른쪽: 상세 패널 */}
      <div className="flex-1 overflow-y-auto">
        <NurseDetailPanel patient={selectedPatient} />
      </div>
    </div>
  );
}

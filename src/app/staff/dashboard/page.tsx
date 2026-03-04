'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMyPatients } from '@/features/staff/hooks/useMyPatients';
import { StaffPatientListPanel } from '@/features/staff/components/StaffPatientListPanel';
import { StaffDetailPanel } from '@/features/staff/components/StaffDetailPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { getTodayString } from '@/lib/date';
import type { PatientSummary } from '@/features/staff/backend/schema';

export default function StaffDashboardPage() {
  const today = getTodayString();
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, refetch } = useMyPatients({ date: today, showAll });
  const patients = data?.patients || [];

  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectPatient = useCallback((patient: PatientSummary) => {
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
    <MasterDetailLayout
      hasSelection={selectedPatient !== null}
      onBack={() => setSelectedPatient(null)}
      master={
        <StaffPatientListPanel
          patients={patients}
          isLoading={isLoading}
          showAll={showAll}
          onShowAllChange={setShowAll}
          selectedPatientId={selectedPatient?.id || null}
          onSelectPatient={handleSelectPatient}
          onRefresh={() => refetch()}
          searchInputRef={searchInputRef}
        />
      }
      detail={
        <StaffDetailPanel patient={selectedPatient} />
      }
    />
  );
}

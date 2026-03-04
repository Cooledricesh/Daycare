'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAdminPatients } from '@/features/admin/hooks/useDashboard';
import { AdminPatientListPanel } from '@/features/admin/components/AdminPatientListPanel';
import { AdminDetailPanel } from '@/features/admin/components/AdminDetailPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { getTodayString } from '@/lib/date';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { NursePatientSummary } from '@/features/nurse/backend/schema';

export default function AdminDashboardPage() {
  const today = getTodayString();
  const { data, isLoading, refetch } = useAdminPatients({ date: today });
  const patients = data?.patients || [];

  const [selectedPatient, setSelectedPatient] = useState<NursePatientSummary | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectPatient = useCallback((patient: NursePatientSummary) => {
    setSelectedPatient(patient);
  }, []);

  useEffect(() => {
    if (selectedPatient && patients.length > 0) {
      const updated = patients.find(p => p.id === selectedPatient.id);
      if (updated) {
        setSelectedPatient(updated);
      }
    }
  }, [patients, selectedPatient]);

  // 환자 목록 탐색: 이전/다음
  const handleNavigatePrev = useCallback(() => {
    if (patients.length === 0) return;
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
    if (patients.length === 0) return;
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
        <AdminPatientListPanel
          patients={patients}
          isLoading={isLoading}
          selectedPatientId={selectedPatient?.id || null}
          onSelectPatient={handleSelectPatient}
          onRefresh={() => refetch()}
          searchInputRef={searchInputRef}
        />
      }
      detail={
        <AdminDetailPanel patient={selectedPatient} />
      }
    />
  );
}

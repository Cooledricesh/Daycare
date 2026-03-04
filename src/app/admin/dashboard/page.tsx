'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAdminPatients } from '@/features/admin/hooks/useDashboard';
import { AdminPatientListPanel } from '@/features/admin/components/AdminPatientListPanel';
import { AdminDetailPanel } from '@/features/admin/components/AdminDetailPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { getTodayString } from '@/lib/date';
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

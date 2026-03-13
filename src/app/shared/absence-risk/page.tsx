'use client';

import { useState, useCallback } from 'react';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { useAbsenceOverview } from '@/features/absence-risk/hooks/useAbsenceOverview';
import { AbsencePatientList } from '@/features/absence-risk/components/AbsencePatientList';
import { AbsenceDetailPanel } from '@/features/absence-risk/components/AbsenceDetailPanel';
import type { AbsencePeriod } from '@/features/absence-risk/constants/risk-thresholds';

export default function AbsenceRiskPage() {
  const [period, setPeriod] = useState<AbsencePeriod>('30d');
  const { data: patients, isLoading, refetch } = useAbsenceOverview(period);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<AbsencePeriod>('30d');

  const handleSelectPatient = useCallback((patientId: string) => {
    setSelectedPatientId(patientId);
  }, []);

  const handlePeriodChange = useCallback(
    (newPeriod: AbsencePeriod) => {
      setPeriod(newPeriod);
      setDetailPeriod(newPeriod);
    },
    [],
  );

  return (
    <MasterDetailLayout
      hasSelection={selectedPatientId !== null}
      onBack={() => setSelectedPatientId(null)}
      master={
        <AbsencePatientList
          patients={patients || []}
          isLoading={isLoading}
          selectedPatientId={selectedPatientId}
          onSelectPatient={handleSelectPatient}
          onRefresh={() => refetch()}
          period={period}
          onPeriodChange={handlePeriodChange}
        />
      }
      detail={
        <AbsenceDetailPanel
          patientId={selectedPatientId}
          period={detailPeriod}
          onPeriodChange={setDetailPeriod}
        />
      }
    />
  );
}

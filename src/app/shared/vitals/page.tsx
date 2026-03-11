'use client';

import { useState, useCallback } from 'react';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { useVitalsOverview } from '@/features/vitals-monitoring/hooks/useVitalsOverview';
import { VitalsPatientList } from '@/features/vitals-monitoring/components/VitalsPatientList';
import { VitalsDetailPanel } from '@/features/vitals-monitoring/components/VitalsDetailPanel';
import type { VitalsPeriod } from '@/features/vitals-monitoring/constants/vitals-ranges';

export default function VitalsMonitoringPage() {
  const { data: patients, isLoading, refetch } = useVitalsOverview();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [period, setPeriod] = useState<VitalsPeriod>('1m');

  const handleSelectPatient = useCallback((patientId: string) => {
    setSelectedPatientId(patientId);
  }, []);

  return (
    <MasterDetailLayout
      hasSelection={selectedPatientId !== null}
      onBack={() => setSelectedPatientId(null)}
      master={
        <VitalsPatientList
          patients={patients || []}
          isLoading={isLoading}
          selectedPatientId={selectedPatientId}
          onSelectPatient={handleSelectPatient}
          onRefresh={() => refetch()}
        />
      }
      detail={
        <VitalsDetailPanel
          patientId={selectedPatientId}
          period={period}
          onPeriodChange={setPeriod}
        />
      }
    />
  );
}

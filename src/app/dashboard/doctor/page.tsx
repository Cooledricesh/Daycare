'use client';

import { useMemo } from 'react';
import { useWaitingPatients } from '@/features/doctor/hooks/useWaitingPatients';
import { PatientListPanel } from '@/features/doctor/components/PatientListPanel';
import { ConsultationPanel } from '@/features/doctor/components/ConsultationPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { KeyboardShortcutHelpModal } from '@/components/KeyboardShortcutHelpModal';
import { TodayHighlightCard } from '@/features/highlights/components/TodayHighlightCard';
import { UpcomingInjectionsCard } from '@/features/injections/components/UpcomingInjectionsCard';
import { usePatientListNavigation } from '@/hooks/usePatientListNavigation';

type FilterTab = 'all' | 'waiting' | 'completed';

const FILTER_TAB_KEYS: FilterTab[] = ['all', 'waiting', 'completed'];
const NOTE_FOCUS_DELAY_MS = 100;

export default function DoctorConsultationPage() {
  const { data: patientsData, isLoading, refetch } = useWaitingPatients();
  const patients = useMemo(() => patientsData || [], [patientsData]);

  const nav = usePatientListNavigation({
    patients,
    filterTabKeys: FILTER_TAB_KEYS,
    onConfirmSelection: () => {
      setTimeout(() => document.getElementById('note')?.focus(), NOTE_FOCUS_DELAY_MS);
    },
  });

  return (
    <>
      <div className="px-4 pt-4">
        <div className="grid gap-4 md:grid-cols-2 mb-4 items-start">
          <TodayHighlightCard patientLinkPrefix="/dashboard/doctor/history" />
          <UpcomingInjectionsCard patientLinkPrefix="/dashboard/doctor/history" />
        </div>
      </div>
      <MasterDetailLayout
        hasSelection={nav.selectedItem !== null}
        onBack={() => nav.setSelectedPatientId(null)}
        master={
          <PatientListPanel
            patients={patients}
            isLoading={isLoading}
            selectedPatientId={nav.selectedItem?.id || null}
            onSelectPatient={nav.handleSelectItem}
            onRefresh={() => refetch()}
            searchInputRef={nav.searchInputRef}
            filterTab={nav.filterTab}
            onFilterTabChange={nav.setFilterTab}
            onFilteredPatientsChange={nav.handleFilteredItemsChange}
          />
        }
        detail={
          <ConsultationPanel
            patient={nav.selectedItem}
            searchInputRef={nav.searchInputRef}
            saveRef={nav.saveRef}
          />
        }
      />
      <KeyboardShortcutHelpModal
        open={nav.showShortcutHelp}
        onOpenChange={nav.setShowShortcutHelp}
      />
    </>
  );
}

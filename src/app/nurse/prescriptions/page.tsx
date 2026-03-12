'use client';

import { useMemo } from 'react';
import { useNursePatients } from '@/features/nurse/hooks/useNursePatients';
import { NursePatientListPanel } from '@/features/nurse/components/NursePatientListPanel';
import { NurseDetailPanel } from '@/features/nurse/components/NurseDetailPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { KeyboardShortcutHelpModal } from '@/components/KeyboardShortcutHelpModal';
import { getTodayString } from '@/lib/date';
import { usePatientListNavigation } from '@/hooks/usePatientListNavigation';
import type { NursePatientSummary } from '@/features/nurse/backend/schema';

type FilterTab = 'all' | 'scheduled' | 'completed';

const FILTER_TAB_KEYS: FilterTab[] = ['all', 'scheduled', 'completed'];

export default function NursePrescriptionsPage() {
  const today = getTodayString();
  const { data, isLoading, refetch } = useNursePatients({ date: today });
  const patients = useMemo(() => data?.patients || [], [data?.patients]);

  const nav = usePatientListNavigation<NursePatientSummary, FilterTab>({
    patients,
    filterTabKeys: FILTER_TAB_KEYS,
  });

  return (
    <>
      <MasterDetailLayout
        hasSelection={nav.selectedItem !== null}
        onBack={() => nav.setSelectedPatientId(null)}
        master={
          <NursePatientListPanel
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
          <NurseDetailPanel patient={nav.selectedItem} />
        }
      />
      <KeyboardShortcutHelpModal
        open={nav.showShortcutHelp}
        onOpenChange={nav.setShowShortcutHelp}
      />
    </>
  );
}

'use client';

import { useMemo } from 'react';
import { useAdminPatients } from '@/features/admin/hooks/useDashboard';
import { AdminPatientListPanel } from '@/features/admin/components/AdminPatientListPanel';
import { AdminDetailPanel } from '@/features/admin/components/AdminDetailPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { KeyboardShortcutHelpModal } from '@/components/KeyboardShortcutHelpModal';
import { TodayHighlightCard } from '@/features/highlights/components/TodayHighlightCard';
import { getTodayString } from '@/lib/date';
import { usePatientListNavigation } from '@/hooks/usePatientListNavigation';
import type { NursePatientSummary } from '@/features/nurse/backend/schema';

type FilterTab = 'all' | 'scheduled' | 'completed';

const FILTER_TAB_KEYS: FilterTab[] = ['all', 'scheduled', 'completed'];

export default function AdminDashboardPage() {
  const today = getTodayString();
  const { data, isLoading, refetch } = useAdminPatients({ date: today });
  const patients = useMemo(() => data?.patients || [], [data?.patients]);

  const nav = usePatientListNavigation<NursePatientSummary, FilterTab>({
    patients,
    filterTabKeys: FILTER_TAB_KEYS,
  });

  return (
    <>
      <div className="px-4 pt-4">
        <TodayHighlightCard patientLinkPrefix="/staff/patient" className="mb-4" />
      </div>
      <MasterDetailLayout
        hasSelection={nav.selectedItem !== null}
        onBack={() => nav.setSelectedPatientId(null)}
        master={
          <AdminPatientListPanel
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
          <AdminDetailPanel patient={nav.selectedItem} />
        }
      />
      <KeyboardShortcutHelpModal
        open={nav.showShortcutHelp}
        onOpenChange={nav.setShowShortcutHelp}
      />
    </>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useMyPatients } from '@/features/staff/hooks/useMyPatients';
import { useBatchAttendance, useCancelAttendance } from '@/features/staff/hooks/useBatchAttendance';
import { StaffPatientListPanel } from '@/features/staff/components/StaffPatientListPanel';
import { StaffDetailPanel } from '@/features/staff/components/StaffDetailPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { KeyboardShortcutHelpModal } from '@/components/KeyboardShortcutHelpModal';
import { getTodayString } from '@/lib/date';
import { usePatientListNavigation } from '@/hooks/usePatientListNavigation';
import { useToast } from '@/hooks/use-toast';
import type { PatientSummary } from '@/features/staff/backend/schema';

type FilterTab = 'all' | 'scheduled' | 'completed';

const FILTER_TAB_KEYS: FilterTab[] = ['all', 'scheduled', 'completed'];

export default function StaffDashboardPage() {
  const today = getTodayString();
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, refetch } = useMyPatients({ date: today, showAll });
  const patients = useMemo(() => data?.patients || [], [data?.patients]);
  const { toast } = useToast();

  const nav = usePatientListNavigation<PatientSummary, FilterTab>({
    patients,
    filterTabKeys: FILTER_TAB_KEYS,
  });

  // 출석 체크 모드
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const batchAttendance = useBatchAttendance();
  const cancelAttendance = useCancelAttendance();
  const [cancelIds, setCancelIds] = useState<Set<string>>(new Set());

  const handleBatchAttendance = () => {
    if (selectedIds.size === 0 && cancelIds.size === 0) return;

    const promises: Promise<void>[] = [];

    if (selectedIds.size > 0) {
      promises.push(
        new Promise((resolve, reject) => {
          batchAttendance.mutate(
            { patientIds: Array.from(selectedIds), date: today },
            { onSuccess: () => resolve(), onError: reject },
          );
        }),
      );
    }

    if (cancelIds.size > 0) {
      promises.push(
        new Promise((resolve, reject) => {
          cancelAttendance.mutate(
            { patientIds: Array.from(cancelIds), date: today },
            { onSuccess: () => resolve(), onError: reject },
          );
        }),
      );
    }

    Promise.all(promises)
      .then(() => {
        const msgs: string[] = [];
        if (selectedIds.size > 0) msgs.push(`${selectedIds.size}명 출석 처리`);
        if (cancelIds.size > 0) msgs.push(`${cancelIds.size}명 출석 취소`);
        toast({
          title: '출석 처리 완료',
          description: msgs.join(', ') + '되었습니다.',
        });
        setAttendanceMode(false);
        setSelectedIds(new Set());
        setCancelIds(new Set());
      })
      .catch(() => {
        toast({
          title: '오류',
          description: '출석 처리에 실패했습니다.',
          variant: 'destructive',
        });
      });
  };

  return (
    <>
      <MasterDetailLayout
        hasSelection={nav.selectedItem !== null}
        onBack={() => nav.setSelectedPatientId(null)}
        master={
          <StaffPatientListPanel
            patients={patients}
            isLoading={isLoading}
            showAll={showAll}
            onShowAllChange={setShowAll}
            selectedPatientId={nav.selectedItem?.id || null}
            onSelectPatient={nav.handleSelectItem}
            onRefresh={() => refetch()}
            searchInputRef={nav.searchInputRef}
            attendanceMode={attendanceMode}
            onAttendanceModeChange={setAttendanceMode}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            cancelIds={cancelIds}
            onCancelIdsChange={setCancelIds}
            onBatchAttendance={handleBatchAttendance}
            isBatchLoading={batchAttendance.isPending || cancelAttendance.isPending}
            filterTab={nav.filterTab}
            onFilterTabChange={nav.setFilterTab}
            onFilteredPatientsChange={nav.handleFilteredItemsChange}
          />
        }
        detail={
          <StaffDetailPanel patient={nav.selectedItem} />
        }
      />
      <KeyboardShortcutHelpModal
        open={nav.showShortcutHelp}
        onOpenChange={nav.setShowShortcutHelp}
      />
    </>
  );
}

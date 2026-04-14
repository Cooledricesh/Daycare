'use client';

import { useState, useMemo } from 'react';
import { useMyPatients } from '@/features/staff/hooks/useMyPatients';
import { useBatchAttendance, useCancelAttendance } from '@/features/staff/hooks/useBatchAttendance';
import { useBatchConsultation, useCancelConsultation } from '@/features/staff/hooks/useBatchConsultation';
import { StaffPatientListPanel } from '@/features/staff/components/StaffPatientListPanel';
import { StaffDetailPanel } from '@/features/staff/components/StaffDetailPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { KeyboardShortcutHelpModal } from '@/components/KeyboardShortcutHelpModal';
import { TodayHighlightCard } from '@/features/highlights/components/TodayHighlightCard';
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

  // 진찰 체크 모드
  const [consultationMode, setConsultationMode] = useState(false);
  const [consultSelectedIds, setConsultSelectedIds] = useState<Set<string>>(new Set());
  const [consultCancelIds, setConsultCancelIds] = useState<Set<string>>(new Set());
  const batchConsultation = useBatchConsultation();
  const cancelConsultation = useCancelConsultation();

  const handleAttendanceModeChange = (mode: boolean) => {
    setAttendanceMode(mode);
    setSelectedIds(new Set());
    setCancelIds(new Set());
    if (mode) {
      setConsultationMode(false);
      setConsultSelectedIds(new Set());
      setConsultCancelIds(new Set());
    }
  };

  const handleConsultationModeChange = (mode: boolean) => {
    setConsultationMode(mode);
    setConsultSelectedIds(new Set());
    setConsultCancelIds(new Set());
    if (mode) {
      setAttendanceMode(false);
      setSelectedIds(new Set());
      setCancelIds(new Set());
    }
  };

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

    let skippedCount = 0;
    let clearedConsultCount = 0;
    if (cancelIds.size > 0) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          cancelAttendance.mutate(
            { patientIds: Array.from(cancelIds), date: today },
            {
              onSuccess: (data) => {
                skippedCount = data.skippedConsulted;
                clearedConsultCount = data.clearedCoordinatorConsultations;
                resolve();
              },
              onError: reject,
            },
          );
        }),
      );
    }

    Promise.all(promises)
      .then(() => {
        const msgs: string[] = [];
        if (selectedIds.size > 0) msgs.push(`${selectedIds.size}명 출석 처리`);
        if (cancelIds.size > 0) {
          const actualCancelled = cancelIds.size - skippedCount;
          if (actualCancelled > 0) msgs.push(`${actualCancelled}명 출석 취소`);
        }
        if (clearedConsultCount > 0) {
          msgs.push(`${clearedConsultCount}명 코디 진찰도 함께 취소`);
        }
        if (skippedCount > 0) {
          msgs.push(`${skippedCount}명은 의사 진찰 완료로 취소 불가`);
        }
        const hasWarning = skippedCount > 0;
        toast({
          title: hasWarning ? '출석 처리 완료 (일부 제외)' : '출석 처리 완료',
          description: msgs.join(', ') + '되었습니다.',
          variant: hasWarning ? 'destructive' : 'default',
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

  const handleBatchConsultation = () => {
    if (consultSelectedIds.size === 0 && consultCancelIds.size === 0) return;

    const promises: Promise<void>[] = [];

    let createdCount = 0;
    let skippedNoDoctorCount = 0;
    if (consultSelectedIds.size > 0) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          batchConsultation.mutate(
            { patientIds: Array.from(consultSelectedIds), date: today },
            {
              onSuccess: (data) => {
                createdCount = data.created;
                skippedNoDoctorCount = data.skippedNoDoctor;
                resolve();
              },
              onError: reject,
            },
          );
        }),
      );
    }

    let cancelledCount = 0;
    let skippedDoctorCount = 0;
    if (consultCancelIds.size > 0) {
      promises.push(
        new Promise<void>((resolve, reject) => {
          cancelConsultation.mutate(
            { patientIds: Array.from(consultCancelIds), date: today },
            {
              onSuccess: (data) => {
                cancelledCount = data.cancelled;
                skippedDoctorCount = data.skippedDoctorConsulted;
                resolve();
              },
              onError: reject,
            },
          );
        }),
      );
    }

    Promise.all(promises)
      .then(() => {
        const msgs: string[] = [];
        if (createdCount > 0) msgs.push(`${createdCount}명 진찰 처리`);
        if (cancelledCount > 0) msgs.push(`${cancelledCount}명 진찰 취소`);
        if (skippedNoDoctorCount > 0) msgs.push(`${skippedNoDoctorCount}명은 주치의 미지정으로 제외`);
        if (skippedDoctorCount > 0) msgs.push(`${skippedDoctorCount}명은 의사 진찰로 취소 불가`);

        const hasWarning = skippedNoDoctorCount > 0 || skippedDoctorCount > 0;
        toast({
          title: hasWarning ? '진찰 처리 완료 (일부 제외)' : '진찰 처리 완료',
          description: msgs.join(', ') + '되었습니다.',
          variant: hasWarning ? 'destructive' : 'default',
        });
        setConsultationMode(false);
        setConsultSelectedIds(new Set());
        setConsultCancelIds(new Set());
      })
      .catch(() => {
        toast({
          title: '오류',
          description: '진찰 처리에 실패했습니다.',
          variant: 'destructive',
        });
      });
  };

  return (
    <>
      <div className="px-4 pt-4">
        <TodayHighlightCard patientLinkPrefix="/dashboard/staff/patient" className="mb-4" />
      </div>
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
            onAttendanceModeChange={handleAttendanceModeChange}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            cancelIds={cancelIds}
            onCancelIdsChange={setCancelIds}
            onBatchAttendance={handleBatchAttendance}
            isBatchLoading={batchAttendance.isPending || cancelAttendance.isPending}
            consultationMode={consultationMode}
            onConsultationModeChange={handleConsultationModeChange}
            consultSelectedIds={consultSelectedIds}
            onConsultSelectedIdsChange={setConsultSelectedIds}
            consultCancelIds={consultCancelIds}
            onConsultCancelIdsChange={setConsultCancelIds}
            onBatchConsultation={handleBatchConsultation}
            isConsultBatchLoading={batchConsultation.isPending || cancelConsultation.isPending}
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

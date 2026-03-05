'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMyPatients } from '@/features/staff/hooks/useMyPatients';
import { useBatchAttendance, useCancelAttendance } from '@/features/staff/hooks/useBatchAttendance';
import { StaffPatientListPanel } from '@/features/staff/components/StaffPatientListPanel';
import { StaffDetailPanel } from '@/features/staff/components/StaffDetailPanel';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { getTodayString } from '@/lib/date';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/hooks/use-toast';
import type { PatientSummary } from '@/features/staff/backend/schema';

export default function StaffDashboardPage() {
  const today = getTodayString();
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, refetch } = useMyPatients({ date: today, showAll });
  const patients = data?.patients || [];
  const { toast } = useToast();

  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
        <StaffPatientListPanel
          patients={patients}
          isLoading={isLoading}
          showAll={showAll}
          onShowAllChange={setShowAll}
          selectedPatientId={selectedPatient?.id || null}
          onSelectPatient={handleSelectPatient}
          onRefresh={() => refetch()}
          searchInputRef={searchInputRef}
          attendanceMode={attendanceMode}
          onAttendanceModeChange={setAttendanceMode}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          cancelIds={cancelIds}
          onCancelIdsChange={setCancelIds}
          onBatchAttendance={handleBatchAttendance}
          isBatchLoading={batchAttendance.isPending || cancelAttendance.isPending}
        />
      }
      detail={
        <StaffDetailPanel patient={selectedPatient} />
      }
    />
  );
}

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useAddManualSchedule } from '../hooks/useSchedule';
import { usePatients } from '../hooks/usePatients';

export function ManualScheduleModal() {
  const { isManualAddModalOpen, selectedDate, closeManualAddModal } = useScheduleStore();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  const { data: patientsData } = usePatients({ page: 1, limit: 100, status: 'active' });
  const addSchedule = useAddManualSchedule();

  const patients = patientsData?.data || [];

  const handleSave = async () => {
    if (!selectedPatientId) {
      alert('환자를 선택해주세요.');
      return;
    }

    try {
      await addSchedule.mutateAsync({
        date: selectedDate,
        patient_id: selectedPatientId,
      });
      setSelectedPatientId('');
      closeManualAddModal();
    } catch (error: any) {
      console.error('Failed to add schedule:', error);
      const message = error.response?.data?.message || '추가에 실패했습니다.';
      alert(message);
    }
  };

  const handleClose = () => {
    setSelectedPatientId('');
    closeManualAddModal();
  };

  return (
    <Dialog open={isManualAddModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>수동 일정 추가</DialogTitle>
          <DialogDescription>
            {selectedDate}에 출석 예정을 수동으로 추가합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patient">환자 선택</Label>
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger id="patient">
                <SelectValue placeholder="환자를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={addSchedule.isPending || !selectedPatientId}>
            {addSchedule.isPending ? '추가 중...' : '추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

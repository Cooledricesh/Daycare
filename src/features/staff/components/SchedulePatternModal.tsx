'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useMySchedulePatterns, useUpdateSchedulePattern } from '../hooks/useSchedulePatterns';

const DAYS = [
  { value: 0, label: '일' },
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
];

export function SchedulePatternModal() {
  const { isModalOpen, selectedPatientId, selectedPatientName, closeModal } = useScheduleStore();
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const { data: patterns } = useMySchedulePatterns();
  const updatePattern = useUpdateSchedulePattern();

  const currentPattern = patterns?.find((p) => p.patient_id === selectedPatientId);

  useEffect(() => {
    if (currentPattern) {
      setSelectedDays(currentPattern.schedule_days || []);
    } else {
      setSelectedDays([]);
    }
  }, [currentPattern, isModalOpen]);

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    if (!selectedPatientId) return;

    try {
      await updatePattern.mutateAsync({
        patientId: selectedPatientId,
        data: { schedule_days: selectedDays },
      });
      closeModal();
    } catch (error) {
      console.error('Failed to update pattern:', error);
      alert('저장에 실패했습니다.');
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>출석 패턴 설정</DialogTitle>
          <DialogDescription>
            {selectedPatientName || '환자'}의 기본 출석 요일을 설정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day) => (
              <div key={day.value} className="flex flex-col items-center gap-2">
                <Checkbox
                  id={`staff-day-${day.value}`}
                  checked={selectedDays.includes(day.value)}
                  onCheckedChange={() => handleDayToggle(day.value)}
                />
                <Label
                  htmlFor={`staff-day-${day.value}`}
                  className={`text-sm cursor-pointer ${
                    day.value === 0 ? 'text-red-500' : day.value === 6 ? 'text-blue-500' : ''
                  }`}
                >
                  {day.label}
                </Label>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-gray-500">
            선택된 요일: {selectedDays.length === 0 ? '없음' : selectedDays.map((d) => DAYS[d].label).join(', ')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeModal}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={updatePattern.isPending}>
            {updatePattern.isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

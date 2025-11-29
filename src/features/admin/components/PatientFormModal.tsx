'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreatePatient, useUpdatePatient, useCoordinators } from '../hooks/usePatients';
import type { PatientWithCoordinator } from '../backend/schema';
import { Loader2 } from 'lucide-react';

const patientFormSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  birth_date: z.string().optional(),
  gender: z.enum(['M', 'F', '']).optional(),
  coordinator_id: z.string().optional(),
  memo: z.string().max(500).optional(),
  schedule_days: z.array(z.number()),
  status: z.enum(['active', 'discharged', 'suspended']).optional(),
});

type PatientFormData = z.infer<typeof patientFormSchema>;

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  patient?: PatientWithCoordinator;
}

const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

export function PatientFormModal({
  isOpen,
  onClose,
  mode,
  patient,
}: PatientFormModalProps) {
  const { data: coordinators } = useCoordinators();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      name: '',
      birth_date: '',
      gender: '',
      coordinator_id: '',
      memo: '',
      schedule_days: [],
      status: 'active',
    },
  });

  const scheduleDays = watch('schedule_days') || [];

  useEffect(() => {
    if (mode === 'edit' && patient) {
      reset({
        name: patient.name,
        birth_date: patient.birth_date || '',
        gender: patient.gender || '',
        coordinator_id: patient.coordinator_id || '',
        memo: patient.memo || '',
        schedule_days: patient.schedule_pattern
          ? patient.schedule_pattern.split(',').map((day) => dayNames.indexOf(day))
          : [],
        status: patient.status,
      });
    } else {
      reset({
        name: '',
        birth_date: '',
        gender: '',
        coordinator_id: '',
        memo: '',
        schedule_days: [],
        status: 'active',
      });
    }
  }, [mode, patient, reset]);

  const onSubmit = async (data: PatientFormData) => {
    try {
      const payload = {
        name: data.name,
        birth_date: data.birth_date || undefined,
        gender: data.gender === '' ? undefined : data.gender,
        coordinator_id: data.coordinator_id || undefined,
        memo: data.memo || undefined,
        schedule_days: data.schedule_days || [],
        status: data.status,
      };

      if (mode === 'create') {
        await createPatient.mutateAsync(payload);
      } else if (patient) {
        await updatePatient.mutateAsync({
          id: patient.id,
          data: payload,
        });
      }

      onClose();
    } catch (error) {
      console.error('Failed to save patient:', error);
    }
  };

  const toggleDay = (day: number) => {
    const current = scheduleDays || [];
    if (current.includes(day)) {
      setValue(
        'schedule_days',
        current.filter((d) => d !== day)
      );
    } else {
      setValue('schedule_days', [...current, day].sort((a, b) => a - b));
    }
  };

  const isLoading = createPatient.isPending || updatePatient.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '환자 추가' : '환자 정보 수정'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 이름 */}
          <div className="space-y-2">
            <Label htmlFor="name">이름 *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="환자 이름"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* 생년월일 */}
          <div className="space-y-2">
            <Label htmlFor="birth_date">생년월일</Label>
            <Input
              id="birth_date"
              type="date"
              {...register('birth_date')}
              disabled={isLoading}
            />
          </div>

          {/* 성별 */}
          <div className="space-y-2">
            <Label>성별</Label>
            <RadioGroup
              value={watch('gender') || ''}
              onValueChange={(value) => setValue('gender', value as 'M' | 'F' | '')}
              disabled={isLoading}
            >
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="M" id="gender-m" />
                  <Label htmlFor="gender-m" className="font-normal cursor-pointer">
                    남
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="F" id="gender-f" />
                  <Label htmlFor="gender-f" className="font-normal cursor-pointer">
                    여
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* 담당 코디 */}
          <div className="space-y-2">
            <Label htmlFor="coordinator_id">담당 코디</Label>
            <Select
              value={watch('coordinator_id') || ''}
              onValueChange={(value) => setValue('coordinator_id', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="담당 코디 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">선택 안 함</SelectItem>
                {coordinators?.map((coordinator) => (
                  <SelectItem key={coordinator.id} value={coordinator.id}>
                    {coordinator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 출석 패턴 */}
          <div className="space-y-2">
            <Label>출석 패턴 (요일 선택)</Label>
            <div className="grid grid-cols-7 gap-2">
              {dayNames.map((day, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 border rounded-md p-2"
                >
                  <Checkbox
                    id={`day-${index}`}
                    checked={scheduleDays.includes(index)}
                    onCheckedChange={() => toggleDay(index)}
                    disabled={isLoading}
                  />
                  <Label
                    htmlFor={`day-${index}`}
                    className="font-normal cursor-pointer flex-1 text-center"
                  >
                    {day}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* 상태 (수정 시만) */}
          {mode === 'edit' && (
            <div className="space-y-2">
              <Label htmlFor="status">상태</Label>
              <Select
                value={watch('status')}
                onValueChange={(value) => setValue('status', value as any)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="discharged">퇴원</SelectItem>
                  <SelectItem value="suspended">중단</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 메모 */}
          <div className="space-y-2">
            <Label htmlFor="memo">메모</Label>
            <Textarea
              id="memo"
              {...register('memo')}
              placeholder="메모 (최대 500자)"
              rows={4}
              disabled={isLoading}
            />
            {errors.memo && (
              <p className="text-sm text-red-600">{errors.memo.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? '추가' : '수정'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

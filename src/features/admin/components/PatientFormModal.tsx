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
import { useCreatePatient, useUpdatePatient, useCoordinators, useDoctors } from '../hooks/usePatients';
import type { PatientWithCoordinator } from '../backend/schema';
import { Loader2 } from 'lucide-react';

const patientFormSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  gender: z.enum(['M', 'F', '']).optional(),
  room_number: z.string().max(10).optional(),
  patient_id_no: z.string().max(20).optional(),
  coordinator_id: z.string().optional(),
  doctor_id: z.string().optional(),
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
  const { data: doctors } = useDoctors();
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
      gender: '',
      room_number: '',
      patient_id_no: '',
      coordinator_id: '',
      doctor_id: '',
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
        gender: patient.gender || '',
        room_number: patient.room_number || '',
        patient_id_no: patient.patient_id_no || '',
        coordinator_id: patient.coordinator_id || '',
        doctor_id: patient.doctor_id || '',
        memo: patient.memo || '',
        schedule_days: patient.schedule_pattern
          ? patient.schedule_pattern.split(',').map((day) => dayNames.indexOf(day))
          : [],
        status: patient.status,
      });
    } else {
      reset({
        name: '',
        gender: '',
        room_number: '',
        patient_id_no: '',
        coordinator_id: '',
        doctor_id: '',
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
        gender: data.gender === '' ? undefined : data.gender,
        room_number: data.room_number || undefined,
        patient_id_no: data.patient_id_no || undefined,
        coordinator_id: data.coordinator_id || undefined,
        doctor_id: data.doctor_id || undefined,
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

          {/* 병록번호 */}
          <div className="space-y-2">
            <Label htmlFor="patient_id_no">병록번호</Label>
            <Input
              id="patient_id_no"
              {...register('patient_id_no')}
              placeholder="병록번호 (최대 20자)"
              disabled={isLoading}
            />
          </div>

          {/* 호실 */}
          <div className="space-y-2">
            <Label htmlFor="room_number">호실</Label>
            <Input
              id="room_number"
              {...register('room_number')}
              placeholder="호실 (예: 3101)"
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

          {/* 주치의 */}
          <div className="space-y-2">
            <Label htmlFor="doctor_id">주치의</Label>
            <Select
              value={watch('doctor_id') || ''}
              onValueChange={(value) => setValue('doctor_id', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="주치의 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">선택 안 함</SelectItem>
                {doctors?.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

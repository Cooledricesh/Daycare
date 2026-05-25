'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  useCreateRoomMapping,
  useUpdateRoomMapping,
} from '../hooks/useRoomMapping';
import { useStaff } from '../hooks/useStaff';
import type { RoomMappingItem } from '../backend/schema';

const ROLE_LABELS: Record<'primary' | 'backup' | 'co', string> = {
  primary: '주담당',
  backup: '백업',
  co: '공동',
};

const assignmentSchema = z.object({
  coordinator_id: z.string().uuid('코디네이터를 선택해주세요'),
  role: z.enum(['primary', 'backup', 'co']),
});

const roomMappingSchema = z
  .object({
    room_prefix: z.string().min(1, '호실 번호를 입력해주세요').max(10),
    assignments: z
      .array(assignmentSchema)
      .min(1, '최소 1명의 코디네이터를 지정해주세요')
      .refine(
        (arr) => arr.filter((a) => a.role === 'primary').length === 1,
        { message: '주담당(primary) 은 정확히 1명이어야 합니다' },
      )
      .refine(
        (arr) => new Set(arr.map((a) => a.coordinator_id)).size === arr.length,
        { message: '동일한 코디네이터가 중복 지정되었습니다' },
      ),
    description: z.string().max(100).optional(),
    is_active: z.boolean(),
  });

type RoomMappingData = z.infer<typeof roomMappingSchema>;

interface RoomMappingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  mapping?: RoomMappingItem;
}

export function RoomMappingFormModal({
  isOpen,
  onClose,
  mode,
  mapping,
}: RoomMappingFormModalProps) {
  const createMapping = useCreateRoomMapping();
  const updateMapping = useUpdateRoomMapping();

  const { data: staffData } = useStaff({ role: 'coordinator', status: 'active' });
  const coordinators = staffData?.data || [];

  const form = useForm<RoomMappingData>({
    resolver: zodResolver(roomMappingSchema),
    defaultValues: {
      room_prefix: '',
      assignments: [{ coordinator_id: '', role: 'primary' }],
      description: '',
      is_active: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'assignments',
  });

  const isActive = useWatch({ control: form.control, name: 'is_active' });
  const assignmentsWatch = useWatch({ control: form.control, name: 'assignments' });

  useEffect(() => {
    if (mode === 'edit' && mapping) {
      const existing = mapping.assignments.length > 0
        ? mapping.assignments.map((a) => ({
            coordinator_id: a.coordinator_id,
            role: a.role,
          }))
        : mapping.coordinator_id
          ? [{ coordinator_id: mapping.coordinator_id, role: 'primary' as const }]
          : [{ coordinator_id: '', role: 'primary' as const }];

      form.reset({
        room_prefix: mapping.room_prefix,
        assignments: existing,
        description: mapping.description || '',
        is_active: mapping.is_active,
      });
    } else {
      form.reset({
        room_prefix: '',
        assignments: [{ coordinator_id: '', role: 'primary' }],
        description: '',
        is_active: true,
      });
    }
  }, [mode, mapping, form]);

  const setRole = (index: number, role: 'primary' | 'backup' | 'co') => {
    // primary 단일성 보장: 새로 primary 로 바꾸면 다른 행은 backup 으로 강등
    if (role === 'primary') {
      fields.forEach((_, i) => {
        if (i !== index) {
          const cur = form.getValues(`assignments.${i}.role`);
          if (cur === 'primary') {
            form.setValue(`assignments.${i}.role`, 'backup');
          }
        }
      });
    }
    form.setValue(`assignments.${index}.role`, role);
  };

  const addAssignmentRow = () => {
    append({ coordinator_id: '', role: 'backup' });
  };

  const onSubmit = async (data: RoomMappingData) => {
    // 빈 coordinator_id 제거 — 사용자가 행만 추가하고 선택 안 한 경우 방어
    const cleanedAssignments = data.assignments.filter((a) => a.coordinator_id);
    if (cleanedAssignments.length === 0) {
      form.setError('assignments', {
        message: '최소 1명의 코디네이터를 지정해주세요',
      });
      return;
    }
    if (cleanedAssignments.filter((a) => a.role === 'primary').length !== 1) {
      form.setError('assignments', {
        message: '주담당(primary) 은 정확히 1명이어야 합니다',
      });
      return;
    }

    const assignmentsPayload = cleanedAssignments.map((a, idx) => ({
      coordinator_id: a.coordinator_id,
      role: a.role,
      display_order: idx,
    }));

    try {
      if (mode === 'create') {
        await createMapping.mutateAsync({
          room_prefix: data.room_prefix,
          assignments: assignmentsPayload,
          description: data.description,
        });
      } else if (mapping) {
        await updateMapping.mutateAsync({
          roomPrefix: mapping.room_prefix,
          data: {
            assignments: assignmentsPayload,
            description: data.description,
            is_active: data.is_active,
          },
        });
      }
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { code?: string } } } };
      const errorCode = err.response?.data?.error?.code;
      if (errorCode === 'ROOM_MAPPING_ALREADY_EXISTS') {
        form.setError('room_prefix', {
          message: '이미 존재하는 호실입니다. 수정 버튼을 사용해 주세요.',
        });
      } else {
        console.error('Failed to save room mapping:', error);
      }
    }
  };

  const isLoading = createMapping.isPending || updateMapping.isPending;

  // 이미 선택된 coordinator id 집합 — 같은 행은 자기 자신 허용
  const selectedIds = new Set(
    (assignmentsWatch ?? []).map((a) => a?.coordinator_id).filter(Boolean) as string[],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '호실 매핑 추가' : '호실 매핑 수정'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* 호실 번호 */}
          <div className="space-y-2">
            <Label htmlFor="room_prefix">호실 번호 *</Label>
            <Input
              id="room_prefix"
              {...form.register('room_prefix')}
              placeholder="예: 3101"
              disabled={isLoading || mode === 'edit'}
            />
            {form.formState.errors.room_prefix && (
              <p className="text-sm text-red-600">
                {form.formState.errors.room_prefix.message}
              </p>
            )}
          </div>

          {/* 담당 코디네이터 (다중) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>담당 코디네이터 *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addAssignmentRow}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-1" /> 코디 추가
              </Button>
            </div>

            <div className="space-y-2">
              {fields.map((field, index) => {
                const currentId = assignmentsWatch?.[index]?.coordinator_id ?? '';
                const currentRole = assignmentsWatch?.[index]?.role ?? 'primary';
                return (
                  <div key={field.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Select
                        value={currentId || '__none__'}
                        onValueChange={(value) =>
                          form.setValue(
                            `assignments.${index}.coordinator_id`,
                            value === '__none__' ? '' : value,
                          )
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="코디네이터 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">미지정</SelectItem>
                          {coordinators.map((coordinator) => {
                            const disabled =
                              selectedIds.has(coordinator.id) &&
                              coordinator.id !== currentId;
                            return (
                              <SelectItem
                                key={coordinator.id}
                                value={coordinator.id}
                                disabled={disabled}
                              >
                                {coordinator.name}
                                {disabled ? ' (중복)' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-28">
                      <Select
                        value={currentRole}
                        onValueChange={(value) =>
                          setRole(index, value as 'primary' | 'backup' | 'co')
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={isLoading || fields.length === 1}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {form.formState.errors.assignments && (
              <p className="text-sm text-red-600">
                {form.formState.errors.assignments.message ||
                  form.formState.errors.assignments.root?.message}
              </p>
            )}
            <p className="text-xs text-gray-500">
              주담당(primary) 1명 필수. 백업/공동 코디는 추가로 지정할 수 있습니다.
            </p>
          </div>

          {/* 설명 */}
          <div className="space-y-2">
            <Label htmlFor="description">설명 (선택)</Label>
            <Input
              id="description"
              {...form.register('description')}
              placeholder="예: 3층 1호실"
              disabled={isLoading}
            />
          </div>

          {/* 상태 (수정 시만) */}
          {mode === 'edit' && (
            <div className="space-y-2">
              <Label>상태</Label>
              <RadioGroup
                value={isActive ? 'active' : 'inactive'}
                onValueChange={(value) =>
                  form.setValue('is_active', value === 'active')
                }
                disabled={isLoading}
              >
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="active" id="status-active" />
                    <Label htmlFor="status-active" className="font-normal cursor-pointer">
                      활성
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="inactive" id="status-inactive" />
                    <Label
                      htmlFor="status-inactive"
                      className="font-normal cursor-pointer"
                    >
                      비활성
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

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

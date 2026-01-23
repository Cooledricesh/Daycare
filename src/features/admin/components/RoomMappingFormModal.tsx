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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import {
  useCreateRoomMapping,
  useUpdateRoomMapping,
} from '../hooks/useRoomMapping';
import { useStaff } from '../hooks/useStaff';
import type { RoomMappingItem } from '../backend/schema';

const roomMappingSchema = z.object({
  room_prefix: z.string().min(1, '호실 번호를 입력해주세요').max(10),
  coordinator_id: z.string().nullable(),
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

  // 코디네이터 목록 가져오기
  const { data: staffData } = useStaff({ role: 'coordinator', status: 'active' });
  const coordinators = staffData?.data || [];

  const form = useForm<RoomMappingData>({
    resolver: zodResolver(roomMappingSchema),
    defaultValues: {
      room_prefix: '',
      coordinator_id: null,
      description: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (mode === 'edit' && mapping) {
      form.reset({
        room_prefix: mapping.room_prefix,
        coordinator_id: mapping.coordinator_id,
        description: mapping.description || '',
        is_active: mapping.is_active,
      });
    } else {
      form.reset({
        room_prefix: '',
        coordinator_id: null,
        description: '',
        is_active: true,
      });
    }
  }, [mode, mapping, form]);

  const onSubmit = async (data: RoomMappingData) => {
    try {
      if (mode === 'create') {
        await createMapping.mutateAsync({
          room_prefix: data.room_prefix,
          coordinator_id: data.coordinator_id,
          description: data.description,
        });
      } else if (mapping) {
        await updateMapping.mutateAsync({
          roomPrefix: mapping.room_prefix,
          data: {
            coordinator_id: data.coordinator_id,
            description: data.description,
            is_active: data.is_active,
          },
        });
      }
      onClose();
    } catch (error: any) {
      const errorCode = error.response?.data?.error?.code;
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
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

          {/* 담당 코디네이터 */}
          <div className="space-y-2">
            <Label>담당 코디네이터</Label>
            <Select
              value={form.watch('coordinator_id') || '__none__'}
              onValueChange={(value) =>
                form.setValue('coordinator_id', value === '__none__' ? null : value)
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="코디네이터 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">미지정</SelectItem>
                {coordinators.map((coordinator) => (
                  <SelectItem key={coordinator.id} value={coordinator.id}>
                    {coordinator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                value={form.watch('is_active') ? 'active' : 'inactive'}
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

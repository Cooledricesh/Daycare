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
import { useCreateStaff, useUpdateStaff } from '../hooks/useStaff';
import type { StaffPublic } from '../backend/schema';
import { Loader2 } from 'lucide-react';

const staffCreateSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  login_id: z.string().min(4, '로그인 ID는 4자 이상이어야 합니다')
    .regex(/^[a-zA-Z0-9_]+$/, '영문, 숫자, _만 사용 가능합니다'),
  password: z.string().min(4, '비밀번호는 4자 이상이어야 합니다'),
  role: z.enum(['doctor', 'coordinator', 'nurse', 'admin']),
});

const staffUpdateSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  role: z.enum(['doctor', 'coordinator', 'nurse', 'admin']),
  is_active: z.boolean(),
});

type StaffCreateData = z.infer<typeof staffCreateSchema>;
type StaffUpdateData = z.infer<typeof staffUpdateSchema>;

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  staff?: StaffPublic;
}

export function StaffFormModal({
  isOpen,
  onClose,
  mode,
  staff,
}: StaffFormModalProps) {
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();

  const createForm = useForm<StaffCreateData>({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: {
      name: '',
      login_id: '',
      password: '',
      role: 'coordinator',
    },
  });

  const updateForm = useForm<StaffUpdateData>({
    resolver: zodResolver(staffUpdateSchema),
    defaultValues: {
      name: '',
      role: 'coordinator',
      is_active: true,
    },
  });

  const form = mode === 'create' ? createForm : updateForm;

  useEffect(() => {
    if (mode === 'edit' && staff) {
      updateForm.reset({
        name: staff.name,
        role: staff.role,
        is_active: staff.is_active,
      });
    } else {
      createForm.reset({
        name: '',
        login_id: '',
        password: '',
        role: 'coordinator',
      });
    }
  }, [mode, staff, createForm, updateForm]);

  const onSubmit = async (data: any) => {
    try {
      if (mode === 'create') {
        await createStaff.mutateAsync(data);
      } else if (staff) {
        await updateStaff.mutateAsync({
          id: staff.id,
          data,
        });
      }
      onClose();
    } catch (error: any) {
      if (error.response?.data?.code === 'DUPLICATE_LOGIN_ID') {
        createForm.setError('login_id', {
          message: '이미 사용 중인 로그인 ID입니다',
        });
      } else {
        console.error('Failed to save staff:', error);
      }
    }
  };

  const isLoading = createStaff.isPending || updateStaff.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '직원 추가' : '직원 정보 수정'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* 이름 */}
          <div className="space-y-2">
            <Label htmlFor="name">이름 *</Label>
            <Input
              id="name"
              {...(form as any).register('name')}
              placeholder="직원 이름"
              disabled={isLoading}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* 로그인 ID (생성 시만) */}
          {mode === 'create' && (
            <div className="space-y-2">
              <Label htmlFor="login_id">로그인 ID *</Label>
              <Input
                id="login_id"
                {...createForm.register('login_id')}
                placeholder="영문, 숫자, _ 사용 가능"
                disabled={isLoading}
              />
              {createForm.formState.errors.login_id && (
                <p className="text-sm text-red-600">
                  {createForm.formState.errors.login_id.message}
                </p>
              )}
            </div>
          )}

          {/* 비밀번호 (생성 시만) */}
          {mode === 'create' && (
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 *</Label>
              <Input
                id="password"
                type="password"
                {...createForm.register('password')}
                placeholder="8자 이상"
                disabled={isLoading}
              />
              {createForm.formState.errors.password && (
                <p className="text-sm text-red-600">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>
          )}

          {/* 역할 */}
          <div className="space-y-2">
            <Label>역할 *</Label>
            <Select
              value={(form as any).watch('role')}
              onValueChange={(value: any) => (form as any).setValue('role', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doctor">의사</SelectItem>
                <SelectItem value="coordinator">코디네이터</SelectItem>
                <SelectItem value="nurse">간호사</SelectItem>
                <SelectItem value="admin">관리자</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 상태 (수정 시만) */}
          {mode === 'edit' && (
            <div className="space-y-2">
              <Label>상태</Label>
              <RadioGroup
                value={updateForm.watch('is_active') ? 'active' : 'inactive'}
                onValueChange={(value) =>
                  updateForm.setValue('is_active', value === 'active')
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

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResetPassword } from '../hooks/useStaff';
import { Loader2 } from 'lucide-react';

const passwordResetSchema = z
  .object({
    new_password: z.string().min(4, '비밀번호는 4자 이상이어야 합니다'),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirm_password'],
  });

type PasswordResetData = z.infer<typeof passwordResetSchema>;

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string | null;
  staffName?: string;
}

export function PasswordResetModal({
  isOpen,
  onClose,
  staffId,
  staffName,
}: PasswordResetModalProps) {
  const resetPassword = useResetPassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordResetData>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      new_password: '',
      confirm_password: '',
    },
  });

  const onSubmit = async (data: PasswordResetData) => {
    if (!staffId) return;

    try {
      await resetPassword.mutateAsync({
        id: staffId,
        data: { new_password: data.new_password },
      });
      reset();
      onClose();
      alert('비밀번호가 성공적으로 초기화되었습니다.');
    } catch (error) {
      console.error('Failed to reset password:', error);
      alert('비밀번호 초기화에 실패했습니다.');
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        reset();
        onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>비밀번호 초기화</DialogTitle>
          {staffName && (
            <DialogDescription>
              <strong>{staffName}</strong> 님의 비밀번호를 초기화합니다.
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 새 비밀번호 */}
          <div className="space-y-2">
            <Label htmlFor="new_password">새 비밀번호 *</Label>
            <Input
              id="new_password"
              type="password"
              {...register('new_password')}
              placeholder="8자 이상"
              disabled={resetPassword.isPending}
            />
            {errors.new_password && (
              <p className="text-sm text-red-600">{errors.new_password.message}</p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div className="space-y-2">
            <Label htmlFor="confirm_password">비밀번호 확인 *</Label>
            <Input
              id="confirm_password"
              type="password"
              {...register('confirm_password')}
              placeholder="비밀번호 재입력"
              disabled={resetPassword.isPending}
            />
            {errors.confirm_password && (
              <p className="text-sm text-red-600">{errors.confirm_password.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={resetPassword.isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              초기화
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

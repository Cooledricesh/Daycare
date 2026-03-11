'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';
import { useUpdateDisplayName } from '../hooks/useUpdateDisplayName';
import { useToast } from '@/hooks/use-toast';
import { extractApiErrorMessage } from '@/lib/remote/api-client';

interface DisplayNameEditButtonProps {
  patientId: string;
  patientName: string;
  currentDisplayName: string | null;
  variant?: 'icon' | 'text';
}

export function DisplayNameEditButton({
  patientId,
  patientName,
  currentDisplayName,
  variant = 'icon',
}: DisplayNameEditButtonProps) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const { mutate, isPending } = useUpdateDisplayName();
  const { toast } = useToast();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setDisplayName(currentDisplayName || '');
    }
    setOpen(isOpen);
  };

  const handleSave = () => {
    const trimmed = displayName.trim();
    const value = trimmed === '' || trimmed === patientName ? null : trimmed;

    mutate(
      { patientId, displayName: value },
      {
        onSuccess: () => {
          toast({
            title: '표시명 변경 완료',
            description: value
              ? `"${patientName}" → "${value}" 로 변경되었습니다.`
              : `표시명이 원래 이름으로 복원되었습니다.`,
          });
          setOpen(false);
        },
        onError: (error) => {
          const message = extractApiErrorMessage(error, '표시명 변경에 실패했습니다.');
          toast({ title: '변경 실패', description: message, variant: 'destructive' });
        },
      },
    );
  };

  const handleReset = () => {
    mutate(
      { patientId, displayName: null },
      {
        onSuccess: () => {
          toast({
            title: '표시명 초기화',
            description: `원래 이름 "${patientName}" 으로 복원되었습니다.`,
          });
          setDisplayName('');
          setOpen(false);
        },
        onError: (error) => {
          const message = extractApiErrorMessage(error, '초기화에 실패했습니다.');
          toast({ title: '초기화 실패', description: message, variant: 'destructive' });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="h-3 w-3 mr-1" />
            표시명 변경
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>환자 표시명 변경</DialogTitle>
          <DialogDescription>
            동명이인 구별을 위해 앱에서 보이는 이름을 변경합니다.
            실제 환자 이름(병록)은 변경되지 않습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm text-gray-500">실제 이름 (병록)</Label>
            <p className="text-sm font-medium mt-1">{patientName}</p>
          </div>
          <div>
            <Label htmlFor="display-name">표시명</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={`예: ${patientName}A, ${patientName}B`}
              className="mt-1"
              maxLength={100}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending) {
                  handleSave();
                }
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              비워두면 원래 이름으로 표시됩니다.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {currentDisplayName && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isPending}
            >
              원래 이름으로 복원
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

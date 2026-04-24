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
import { RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRegenerateMonthlyReport } from '../hooks/useRegenerateMonthlyReport';
import { extractApiErrorMessage } from '@/lib/remote/api-client';

interface RegenerateButtonProps {
  year: number;
  month: number;
}

export function RegenerateButton({ year, month }: RegenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const regenerate = useRegenerateMonthlyReport();

  const handleConfirm = async () => {
    try {
      await regenerate.mutateAsync({ year, month });
      toast({
        title: '리포트 재계산 완료',
        description: `${year}년 ${month}월 리포트가 재계산되었습니다.`,
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: '리포트 재계산 실패',
        description: extractApiErrorMessage(error, '다시 시도해주세요.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          재계산
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>리포트 재계산</DialogTitle>
          <DialogDescription>
            {year}년 {month}월 리포트를 다시 계산합니다.
            기존 액션 아이템은 보존됩니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={regenerate.isPending}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={regenerate.isPending}>
            {regenerate.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                계산 중...
              </>
            ) : (
              '재계산'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

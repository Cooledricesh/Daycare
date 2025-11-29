'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCompleteTask } from '../hooks/useCompleteTask';
import { useToast } from '@/hooks/use-toast';

type TaskCompletionButtonProps = {
  consultationId: string;
  isCompleted: boolean;
  onSuccess?: () => void;
};

export function TaskCompletionButton({
  consultationId,
  isCompleted,
  onSuccess,
}: TaskCompletionButtonProps) {
  const [checked, setChecked] = useState(isCompleted);
  const { mutate: completeTask, isPending } = useCompleteTask();
  const { toast } = useToast();

  const handleChange = (value: boolean) => {
    if (value && !isCompleted) {
      completeTask(
        { consultationId },
        {
          onSuccess: () => {
            setChecked(true);
            toast({
              title: '처리 완료',
              description: '지시사항이 처리 완료되었습니다.',
            });
            onSuccess?.();
          },
          onError: (error) => {
            setChecked(false);
            toast({
              title: '처리 실패',
              description: error.message,
              variant: 'destructive',
            });
          },
        },
      );
    } else {
      setChecked(value);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`task-${consultationId}`}
        checked={checked}
        onCheckedChange={handleChange}
        disabled={isPending || isCompleted}
      />
      <label
        htmlFor={`task-${consultationId}`}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        처리 완료 체크
      </label>
    </div>
  );
}

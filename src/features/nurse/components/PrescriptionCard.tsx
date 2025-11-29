'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { PrescriptionItem } from '../backend/schema';
import { useCompleteTask } from '../hooks/useCompleteTask';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

type PrescriptionCardProps = {
  prescription: PrescriptionItem;
};

export function PrescriptionCard({ prescription }: PrescriptionCardProps) {
  const [checked, setChecked] = useState(prescription.is_completed);
  const { mutate: completeTask, isPending } = useCompleteTask();
  const { toast } = useToast();

  const handleChange = (value: boolean) => {
    if (value && !prescription.is_completed) {
      completeTask(
        { consultationId: prescription.consultation_id },
        {
          onSuccess: () => {
            setChecked(true);
            toast({
              title: '처리 완료',
              description: '지시사항이 처리 완료되었습니다.',
            });
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
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">{prescription.patient_name}</h3>
            {prescription.coordinator_name && (
              <p className="text-sm text-gray-500">
                담당: {prescription.coordinator_name}
              </p>
            )}
            <p className="text-sm text-gray-500">
              처방의: {prescription.doctor_name}
            </p>
          </div>

          {prescription.is_completed && (
            <Badge variant="default">처리 완료 ✓</Badge>
          )}
        </div>

        <p className="text-gray-800 mb-3">{prescription.task_content}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`task-${prescription.consultation_id}`}
              checked={checked}
              onCheckedChange={handleChange}
              disabled={isPending || prescription.is_completed}
            />
            <label
              htmlFor={`task-${prescription.consultation_id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              처리 완료
            </label>
          </div>

          {prescription.completed_at && (
            <span className="text-xs text-gray-500">
              {format(new Date(prescription.completed_at), 'HH:mm', {
                locale: ko,
              })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { NursePatientSummary } from '../backend/schema';
import { useCompleteTask } from '../hooks/useCompleteTask';

type NursePatientCardProps = {
  patient: NursePatientSummary;
};

export function NursePatientCard({ patient }: NursePatientCardProps) {
  const [checked, setChecked] = useState(patient.task_completed);
  const { mutate: completeTask, isPending } = useCompleteTask();
  const { toast } = useToast();

  const getBorderColor = () => {
    if (patient.has_nurse_task && !patient.task_completed) return 'border-l-orange-500';
    if (patient.is_consulted) return 'border-l-green-500';
    if (patient.is_attended) return 'border-l-blue-500';
    return 'border-l-gray-300';
  };

  const handleTaskComplete = (value: boolean | 'indeterminate') => {
    if (value === true && !patient.task_completed && patient.consultation_id) {
      setChecked(true);
      completeTask(
        { consultationId: patient.consultation_id },
        {
          onSuccess: () => {
            toast({ title: '처리 완료', description: '지시사항이 처리 완료되었습니다.' });
          },
          onError: () => {
            setChecked(false);
            toast({ title: '처리 실패', description: '다시 시도해주세요.', variant: 'destructive' });
          },
        },
      );
    }
  };

  return (
    <Card className={cn('border-l-4 transition-shadow hover:shadow-md', getBorderColor())}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <User className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{patient.name}</h3>
              {patient.attendance_time && (
                <p className="text-xs text-gray-500">
                  {format(new Date(patient.attendance_time), 'HH:mm', { locale: ko })} 출석
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {patient.has_nurse_task && !patient.task_completed && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                <Bell className="w-3 h-3" />
                지시
              </span>
            )}
            {patient.task_completed && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                처리 완료
              </Badge>
            )}
            <Link href={`/nurse/patient/${patient.id}`}>
              <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                상세
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-2">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md',
            patient.is_attended ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500',
          )}>
            {patient.is_attended ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {patient.is_attended ? '출석' : '미출석'}
          </span>
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md',
            patient.is_consulted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
          )}>
            {patient.is_consulted ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {patient.is_consulted ? '진찰 완료' : '진찰 대기'}
          </span>
        </div>

        {patient.is_consulted && patient.doctor_name && (
          <p className="text-sm text-gray-500 mb-2">담당의: {patient.doctor_name}</p>
        )}

        {patient.note && (
          <p className="text-gray-700 text-sm bg-gray-50 p-2 rounded mb-2 line-clamp-2">
            {patient.note}
          </p>
        )}

        {patient.has_nurse_task && patient.task_content && (
          <div className="mt-2 p-2 bg-orange-50 rounded-md border border-orange-200">
            <p className="text-sm text-orange-800 mb-2">
              <span className="font-medium">간호 지시:</span> {patient.task_content}
            </p>
            {!patient.task_completed && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`nurse-task-${patient.id}`}
                  checked={checked}
                  onCheckedChange={handleTaskComplete}
                  disabled={isPending || patient.task_completed}
                />
                <label
                  htmlFor={`nurse-task-${patient.id}`}
                  className="text-sm font-medium leading-none"
                >
                  처리 완료
                </label>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

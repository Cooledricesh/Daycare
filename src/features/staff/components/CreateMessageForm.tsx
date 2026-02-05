'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useCreateMessage } from '../hooks/useMessages';
import { useMyPatients } from '../hooks/useMyPatients';
import { getTodayString } from '@/lib/date';

const formSchema = z.object({
  patient_id: z.string().uuid('환자를 선택해주세요'),
  content: z.string().min(1, '내용을 입력해주세요'),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateMessageFormProps {
  onSuccess?: () => void;
}

export function CreateMessageForm({ onSuccess }: CreateMessageFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: patientsData } = useMyPatients();
  const createMessage = useCreateMessage();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: '',
      content: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await createMessage.mutateAsync({
        patient_id: values.patient_id,
        date: getTodayString(),
        content: values.content,
      });
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const patients = patientsData?.patients || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="patient_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>환자 선택</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="환자를 선택해주세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>전달내용</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="의사에게 전달할 내용을 입력하세요"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? '저장 중...' : '전달사항 저장'}
        </Button>
      </form>
    </Form>
  );
}

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useNurseCreateMessage } from '../hooks/useNurseCreateMessage';
import { useToast } from '@/hooks/use-toast';

const messageFormSchema = z.object({
  content: z.string().min(1, '내용을 입력해주세요'),
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

type NurseMessageFormProps = {
  patientId: string;
  date: string;
  onSuccess?: () => void;
};

export function NurseMessageForm({ patientId, date, onSuccess }: NurseMessageFormProps) {
  const { mutate: createMessage, isPending } = useNurseCreateMessage();
  const { toast } = useToast();

  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: {
      content: '',
    },
  });

  const onSubmit = (values: MessageFormValues) => {
    createMessage(
      {
        patientId,
        date,
        content: values.content,
      },
      {
        onSuccess: () => {
          toast({
            title: '전송 완료',
            description: '전달사항이 저장되었습니다.',
          });
          form.reset();
          onSuccess?.();
        },
        onError: () => {
          toast({
            title: '전송 실패',
            description: '다시 시도해주세요.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>주치의에게 전달사항</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="내용을 입력하세요..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? '전송 중...' : '전송'}
        </Button>
      </form>
    </Form>
  );
}

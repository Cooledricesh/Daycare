'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { ConsultationRecord } from '../backend/schema';

interface ConsultationHistoryProps {
  consultations: ConsultationRecord[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function ConsultationHistory({ consultations }: ConsultationHistoryProps) {
  if (consultations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>진찰 기록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">진찰 기록이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>진찰 기록 ({consultations.length}건)</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {consultations.map((consultation) => (
            <AccordionItem key={consultation.id} value={consultation.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <span className="font-medium">{formatDate(consultation.date)}</span>
                  <span className="text-gray-500 text-sm">({consultation.doctor_name})</span>
                  {consultation.has_task && (
                    <Badge variant="secondary" className="text-xs">지시사항</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {consultation.note && (
                    <div>
                      <p className="text-sm text-gray-600">면담 내용:</p>
                      <p className="text-sm whitespace-pre-wrap">{consultation.note}</p>
                    </div>
                  )}
                  {consultation.has_task && consultation.task_content && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded">
                      <p className="text-sm text-gray-600">지시사항:</p>
                      <p className="text-sm">{consultation.task_content}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        대상: {consultation.task_target === 'coordinator' ? '코디' :
                               consultation.task_target === 'nurse' ? '간호사' :
                               consultation.task_target === 'both' ? '코디+간호사' : '-'}
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

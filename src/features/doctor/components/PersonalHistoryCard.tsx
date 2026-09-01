'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FileText } from 'lucide-react';
import type {
  ClinicalHistoryStatus,
  PersonalHistory,
} from '../backend/schema';

interface PersonalHistoryCardProps {
  status: ClinicalHistoryStatus;
  history: PersonalHistory | null;
}

const HISTORY_SECTIONS: Array<{
  key: keyof Pick<PersonalHistory, 'onset_text' | 'course_text' | 'current_text'>;
  label: string;
}> = [
  { key: 'onset_text', label: '초발' },
  { key: 'course_text', label: '주요 경과' },
  { key: 'current_text', label: '현재 상태' },
];

export function PersonalHistoryCard({ status, history }: PersonalHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          개인력 요약
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'unavailable' && (
          <p className="text-sm text-amber-700">개인력 요약을 불러올 수 없습니다.</p>
        )}
        {status === 'not_found' && (
          <p className="text-sm text-gray-500">등록된 개인력 요약이 없습니다.</p>
        )}
        {status === 'available' && history && (
          <div className="space-y-4">
            <div className="rounded-lg bg-violet-50 p-4 text-sm leading-6 text-violet-950">
              {history.summary_text || '한줄 요약이 없습니다.'}
            </div>

            <Accordion type="multiple" className="w-full">
              {HISTORY_SECTIONS.map(({ key, label }) => (
                <AccordionItem key={key} value={key}>
                  <AccordionTrigger>{label}</AccordionTrigger>
                  <AccordionContent>
                    <p className="whitespace-pre-wrap leading-6 text-gray-700">
                      {history[key] || '기록 없음'}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
              <AccordionItem value="full_markdown">
                <AccordionTrigger>전체 개인력 보기</AccordionTrigger>
                <AccordionContent>
                  <div className="whitespace-pre-wrap leading-6 text-gray-700">
                    {history.full_markdown || '기록 없음'}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {history.updated_at && (
              <p className="text-right text-xs text-gray-400">
                갱신 {history.updated_at.slice(0, 10)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

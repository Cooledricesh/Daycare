'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ConsultationRecord } from '../backend/schema';

interface ConsultationHistoryProps {
  consultations: ConsultationRecord[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function ConsultationItem({ consultation }: { consultation: ConsultationRecord }) {
  return (
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
  );
}

export function ConsultationHistory({ consultations }: ConsultationHistoryProps) {
  const [showOlder, setShowOlder] = useState(false);

  // 최근 1개월과 이전 기록 분리
  const { recentConsultations, olderConsultations, olderGrouped } = useMemo(() => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const cutoffDate = oneMonthAgo.toISOString().split('T')[0];

    const recent: ConsultationRecord[] = [];
    const older: ConsultationRecord[] = [];

    for (const c of consultations) {
      if (c.date >= cutoffDate) {
        recent.push(c);
      } else {
        older.push(c);
      }
    }

    // 이전 기록을 월별로 그룹핑
    const grouped: Record<string, ConsultationRecord[]> = {};
    for (const c of older) {
      const label = formatMonthLabel(c.date);
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(c);
    }

    return { recentConsultations: recent, olderConsultations: older, olderGrouped: grouped };
  }, [consultations]);

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
        {/* 최근 1개월 기록 */}
        {recentConsultations.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            {recentConsultations.map((consultation) => (
              <ConsultationItem key={consultation.id} consultation={consultation} />
            ))}
          </Accordion>
        )}

        {recentConsultations.length === 0 && (
          <p className="text-gray-500 text-sm py-2">최근 1개월 내 기록이 없습니다.</p>
        )}

        {/* 이전 기록 토글 */}
        {olderConsultations.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-gray-500"
              onClick={() => setShowOlder(!showOlder)}
            >
              {showOlder ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  이전 기록 접기
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  이전 기록 보기 ({olderConsultations.length}건)
                </>
              )}
            </Button>

            {showOlder && (
              <div className="mt-3 space-y-4">
                {Object.entries(olderGrouped).map(([monthLabel, records]) => (
                  <div key={monthLabel}>
                    <p className="text-xs font-medium text-gray-400 mb-2">{monthLabel}</p>
                    <Accordion type="single" collapsible className="w-full">
                      {records.map((consultation) => (
                        <ConsultationItem key={consultation.id} consultation={consultation} />
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

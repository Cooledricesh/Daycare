'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { ConsultationRecord } from '../backend/schema';

interface ConsultationHistoryProps {
  consultations: ConsultationRecord[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

function formatMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

// 기록을 텍스트로 변환 (복사용)
function recordToText(c: ConsultationRecord): string {
  let text = formatDate(c.date);
  if (c.note) text += ` ${c.note}`;
  if (c.has_task && c.task_content) {
    const target = c.task_target === 'coordinator' ? '코디' :
      c.task_target === 'nurse' ? '간호사' :
      c.task_target === 'both' ? '코디+간호사' : '';
    text += `\n지시: ${c.task_content}${target ? ` (${target})` : ''}`;
  }
  return text;
}

function recordsToText(records: ConsultationRecord[]): string {
  return records.map(recordToText).join('\n\n');
}

// 플랫 기록 아이템 - 날짜 + 내용 바로 노출
function FlatItem({ consultation }: { consultation: ConsultationRecord }) {
  return (
    <div className="py-2.5 border-b last:border-b-0">
      <div className="text-sm">
        <span className="font-medium text-gray-900">{formatDate(consultation.date)}</span>
        <span className="text-gray-400 ml-1.5 text-xs">({consultation.doctor_name})</span>
      </div>
      {consultation.note && (
        <p className="text-sm whitespace-pre-wrap text-gray-700 mt-1">{consultation.note}</p>
      )}
      {consultation.has_task && consultation.task_content && (
        <div className="mt-1.5 p-2 bg-yellow-50 rounded text-sm">
          <span className="text-yellow-700 font-medium">지시: </span>
          <span>{consultation.task_content}</span>
          <span className="text-gray-400 text-xs ml-1">
            ({consultation.task_target === 'coordinator' ? '코디' :
              consultation.task_target === 'nurse' ? '간호사' :
              consultation.task_target === 'both' ? '코디+간호사' : '-'})
          </span>
        </div>
      )}
      {!consultation.note && !consultation.has_task && (
        <p className="text-sm text-gray-400 mt-1">메모 없음</p>
      )}
    </div>
  );
}

export function ConsultationHistory({ consultations }: ConsultationHistoryProps) {
  const [showOlder, setShowOlder] = useState(false);
  const [copied, setCopied] = useState(false);

  // 최근 1개월 / 1개월 이전 분리
  const { recentConsultations, olderConsultations, olderGrouped } = useMemo(() => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const monthCutoff = oneMonthAgo.toISOString().split('T')[0];

    const recent: ConsultationRecord[] = [];
    const older: ConsultationRecord[] = [];

    for (const c of consultations) {
      if (c.date >= monthCutoff) {
        recent.push(c);
      } else {
        older.push(c);
      }
    }

    // 이전 기록 월별 그룹핑
    const grouped: Record<string, ConsultationRecord[]> = {};
    for (const c of older) {
      const label = formatMonthLabel(c.date);
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(c);
    }

    return { recentConsultations: recent, olderConsultations: older, olderGrouped: grouped };
  }, [consultations]);

  // 현재 보이는 기록 전체 복사
  const handleCopy = useCallback(async () => {
    const visible = showOlder
      ? consultations
      : recentConsultations;
    const text = recordsToText(visible);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [consultations, recentConsultations, showOlder]);

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
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>진찰 기록 ({consultations.length}건)</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-600 h-8 px-2"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
              <span className="text-xs text-green-500">복사됨</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">기록 복사</span>
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {/* 최근 1개월: 모두 바로 노출 */}
        {recentConsultations.length > 0 ? (
          <div>
            {recentConsultations.map((c) => (
              <FlatItem key={c.id} consultation={c} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm py-2">최근 1개월 내 기록이 없습니다.</p>
        )}

        {/* 1개월 이전: 토글 */}
        {olderConsultations.length > 0 && (
          <div className="mt-3 border-t pt-3">
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
              <div className="mt-2">
                {Object.entries(olderGrouped).map(([monthLabel, records]) => (
                  <div key={monthLabel}>
                    <p className="text-xs font-medium text-gray-400 mt-3 mb-1">{monthLabel}</p>
                    {records.map((c) => (
                      <FlatItem key={c.id} consultation={c} />
                    ))}
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

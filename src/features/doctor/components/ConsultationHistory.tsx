'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Copy, Check, X } from 'lucide-react';
import type { ConsultationRecord, MessageRecord } from '../backend/schema';

interface ConsultationHistoryProps {
  consultations: ConsultationRecord[];
  messages?: MessageRecord[];
  currentUserId?: string;
  currentUserRole?: string;
  onDeleteMessage?: (messageId: string) => void;
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
  if (isAppEntered(c.date, c.created_at)) {
    text += ` (${c.doctor_name})`;
  }
  if (c.note) text += ` ${c.note}`;
  if (c.has_task && c.task_content) {
    text += `\n투약/전달: ${c.task_content}`;
  }
  return text;
}

function recordsToText(records: ConsultationRecord[]): string {
  return records.map(recordToText).join('\n\n');
}

// 통합 타임라인 아이템 타입
type TimelineItem =
  | { type: 'consultation'; date: string; data: ConsultationRecord }
  | { type: 'message'; date: string; data: MessageRecord };

function hasContent(c: ConsultationRecord): boolean {
  return !!(c.note || (c.has_task && c.task_content));
}

// 앱에서 직접 입력한 데이터인지 판별 (created_at이 date와 2일 이내)
function isAppEntered(date: string, createdAt: string | null): boolean {
  if (!createdAt) return false;
  const d = new Date(date + 'T00:00:00');
  const c = new Date(createdAt);
  const diffMs = Math.abs(c.getTime() - d.getTime());
  return diffMs < 2 * 24 * 60 * 60 * 1000; // 2일 이내
}

// 진찰 기록 아이템
function ConsultationItem({ consultation }: { consultation: ConsultationRecord }) {
  return (
    <>
      {consultation.note && (
        <p className="text-sm whitespace-pre-wrap text-gray-700 mt-1">{consultation.note}</p>
      )}
      {consultation.has_task && consultation.task_content && (
        <div className="mt-1.5 p-2 bg-yellow-50 rounded text-sm">
          <span className="text-yellow-700 font-medium">투약/전달: </span>
          <span>{consultation.task_content}</span>
        </div>
      )}
    </>
  );
}

// 전달사항 아이템
function MessageItem({ message, onDelete }: { message: MessageRecord; onDelete?: (id: string) => void }) {
  return (
    <div className="mt-1.5 p-2 bg-blue-50 rounded text-sm group relative">
      <span className="text-blue-700 font-medium">{message.author_name}: </span>
      <span>{message.content}</span>
      {onDelete && (
        <button
          type="button"
          className="absolute top-1.5 right-1.5 p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onDelete(message.id)}
          title="삭제"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// 날짜별 통합 아이템
function FlatItem({ consultation }: { consultation: ConsultationRecord }) {
  if (!hasContent(consultation)) return null;
  const showName = isAppEntered(consultation.date, consultation.created_at);
  return (
    <div className="py-2.5 border-b last:border-b-0">
      <div className="text-sm">
        <span className="font-medium text-gray-900">{formatDate(consultation.date)}</span>
        {showName && <span className="text-gray-400 ml-1.5 text-xs">({consultation.doctor_name})</span>}
      </div>
      <ConsultationItem consultation={consultation} />
    </div>
  );
}

// 타임라인 아이템을 날짜별로 그룹핑
function buildTimeline(consultations: ConsultationRecord[], messages: MessageRecord[]): Map<string, TimelineItem[]> {
  const map = new Map<string, TimelineItem[]>();

  for (const c of consultations) {
    if (hasContent(c)) {
      if (!map.has(c.date)) map.set(c.date, []);
      map.get(c.date)!.push({ type: 'consultation', date: c.date, data: c });
    }
  }
  for (const m of messages) {
    if (!map.has(m.date)) map.set(m.date, []);
    map.get(m.date)!.push({ type: 'message', date: m.date, data: m });
  }

  // 날짜 내림차순 정렬
  return new Map([...map.entries()].sort(([a], [b]) => b.localeCompare(a)));
}

function TimelineDateGroup({ date, items, currentUserId, isAdmin, onDeleteMessage }: { date: string; items: TimelineItem[]; currentUserId?: string; isAdmin?: boolean; onDeleteMessage?: (id: string) => void }) {
  const firstConsultation = items.find(i => i.type === 'consultation');
  const consultation = firstConsultation ? (firstConsultation.data as ConsultationRecord) : null;
  const showName = consultation && isAppEntered(consultation.date, consultation.created_at);

  return (
    <div className="py-2.5 border-b last:border-b-0">
      <div className="text-sm">
        <span className="font-medium text-gray-900">{formatDate(date)}</span>
        {showName && <span className="text-gray-400 ml-1.5 text-xs">({consultation.doctor_name})</span>}
      </div>
      {items.map((item, i) => {
        if (item.type === 'consultation') {
          return <ConsultationItem key={`c-${i}`} consultation={item.data as ConsultationRecord} />;
        }
        const msg = item.data as MessageRecord;
        const canDelete = isAdmin || (currentUserId && msg.author_id === currentUserId);
        return <MessageItem key={`m-${i}`} message={msg} onDelete={canDelete ? onDeleteMessage : undefined} />;
      })}
    </div>
  );
}

export function ConsultationHistory({ consultations, messages = [], currentUserId, currentUserRole, onDeleteMessage }: ConsultationHistoryProps) {
  const isAdmin = currentUserRole === 'admin';
  const [showOlder, setShowOlder] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasMessages = messages.length > 0;

  // 내용 있는 기록만 필터
  const meaningfulConsultations = useMemo(
    () => consultations.filter(hasContent),
    [consultations],
  );

  // 통합 타임라인 (messages가 있을 때)
  const timeline = useMemo(
    () => hasMessages ? buildTimeline(consultations, messages) : null,
    [consultations, messages, hasMessages],
  );

  // 최근 1개월 / 1개월 이전 분리
  const { recentDates, olderDates, recentConsultations, olderConsultations, olderGrouped } = useMemo(() => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const monthCutoff = oneMonthAgo.toISOString().split('T')[0];

    if (timeline) {
      // 통합 타임라인 모드
      const recentD: [string, TimelineItem[]][] = [];
      const olderD: [string, TimelineItem[]][] = [];

      for (const [date, items] of timeline) {
        if (date >= monthCutoff) {
          recentD.push([date, items]);
        } else {
          olderD.push([date, items]);
        }
      }

      // 이전 기록 월별 그룹핑
      const grouped: Record<string, [string, TimelineItem[]][]> = {};
      for (const entry of olderD) {
        const label = formatMonthLabel(entry[0]);
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(entry);
      }

      return {
        recentDates: recentD,
        olderDates: olderD,
        recentConsultations: [] as ConsultationRecord[],
        olderConsultations: [] as ConsultationRecord[],
        olderGrouped: {} as Record<string, ConsultationRecord[]>,
      };
    }

    // 기존 모드 (consultation만)
    const recent: ConsultationRecord[] = [];
    const older: ConsultationRecord[] = [];

    for (const c of meaningfulConsultations) {
      if (c.date >= monthCutoff) {
        recent.push(c);
      } else {
        older.push(c);
      }
    }

    const grouped: Record<string, ConsultationRecord[]> = {};
    for (const c of older) {
      const label = formatMonthLabel(c.date);
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(c);
    }

    return {
      recentDates: [] as [string, TimelineItem[]][],
      olderDates: [] as [string, TimelineItem[]][],
      recentConsultations: recent,
      olderConsultations: older,
      olderGrouped: grouped,
    };
  }, [timeline, meaningfulConsultations]);

  const totalCount = timeline ? timeline.size : meaningfulConsultations.length;
  const olderCount = timeline ? olderDates.length : olderConsultations.length;

  // 현재 보이는 기록 전체 복사
  const handleCopy = useCallback(async () => {
    const visible = showOlder
      ? meaningfulConsultations
      : meaningfulConsultations.filter(c => {
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          return c.date >= oneMonthAgo.toISOString().split('T')[0];
        });
    const text = recordsToText(visible);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [meaningfulConsultations, showOlder]);

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>기록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">기록이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>기록 ({totalCount}건)</CardTitle>
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
        {/* 최근 1개월 */}
        {timeline ? (
          // 통합 타임라인 모드
          recentDates.length > 0 ? (
            <div>
              {recentDates.map(([date, items]) => (
                <TimelineDateGroup key={date} date={date} items={items} currentUserId={currentUserId} isAdmin={isAdmin} onDeleteMessage={onDeleteMessage} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm py-2">최근 1개월 내 기록이 없습니다.</p>
          )
        ) : (
          // 기존 모드
          recentConsultations.length > 0 ? (
            <div>
              {recentConsultations.map((c) => (
                <FlatItem key={c.id} consultation={c} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm py-2">최근 1개월 내 기록이 없습니다.</p>
          )
        )}

        {/* 1개월 이전: 토글 */}
        {olderCount > 0 && (
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
                  이전 기록 보기 ({olderCount}건)
                </>
              )}
            </Button>

            {showOlder && (
              <div className="mt-2">
                {timeline ? (
                  // 통합 타임라인
                  (() => {
                    const grouped: Record<string, [string, TimelineItem[]][]> = {};
                    for (const entry of olderDates) {
                      const label = formatMonthLabel(entry[0]);
                      if (!grouped[label]) grouped[label] = [];
                      grouped[label].push(entry);
                    }
                    return Object.entries(grouped).map(([monthLabel, entries]) => (
                      <div key={monthLabel}>
                        <p className="text-xs font-medium text-gray-400 mt-3 mb-1">{monthLabel}</p>
                        {entries.map(([date, items]) => (
                          <TimelineDateGroup key={date} date={date} items={items} currentUserId={currentUserId} isAdmin={isAdmin} onDeleteMessage={onDeleteMessage} />
                        ))}
                      </div>
                    ));
                  })()
                ) : (
                  // 기존 모드
                  Object.entries(olderGrouped).map(([monthLabel, records]) => (
                    <div key={monthLabel}>
                      <p className="text-xs font-medium text-gray-400 mt-3 mb-1">{monthLabel}</p>
                      {records.map((c) => (
                        <FlatItem key={c.id} consultation={c} />
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

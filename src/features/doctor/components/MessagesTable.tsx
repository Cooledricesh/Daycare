'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import type { DoctorMessage } from '../backend/schema';

interface MessagesTableProps {
  messages: DoctorMessage[];
  onMarkRead?: (messageId: string) => void;
  isMarkingRead?: boolean;
  patientLinkPrefix?: string;
}

export function MessagesTable({ messages, onMarkRead, isMarkingRead, patientLinkPrefix = '/doctor/history' }: MessagesTableProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        해당 기간의 전달사항이 없습니다.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-start gap-3 py-3 px-1 ${!msg.is_read ? 'bg-blue-50/50' : ''}`}
        >
          {msg.is_read ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          ) : onMarkRead ? (
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={false}
              disabled={isMarkingRead}
              onCheckedChange={() => onMarkRead(msg.id)}
            />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Link
                href={`${patientLinkPrefix}/${msg.patient_id}`}
                className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
              >
                {msg.patient_name}
              </Link>
              <span className="text-xs text-gray-400">{msg.date}</span>
              {!msg.is_read && (
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              )}
            </div>
            <p className="text-sm text-gray-700 line-clamp-2">{msg.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

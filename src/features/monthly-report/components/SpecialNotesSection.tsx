'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { match } from 'ts-pattern';
import { SPECIAL_NOTE_TYPE_LABELS } from '../constants/labels';
import type { SpecialNoteEntry } from '../lib/dto';

interface SpecialNotesSectionProps {
  specialNotes: SpecialNoteEntry[];
}

function NoteTypeBadge({ type }: { type: SpecialNoteEntry['type'] }) {
  const variant = match(type)
    .with('holiday', () => 'secondary' as const)
    .with('outlier', () => 'default' as const)
    .with('data_gap', () => 'destructive' as const)
    .exhaustive();

  return <Badge variant={variant}>{SPECIAL_NOTE_TYPE_LABELS[type]}</Badge>;
}

export function SpecialNotesSection({ specialNotes }: SpecialNotesSectionProps) {
  if (specialNotes.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">특이사항</h2>
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-gray-500 text-center">이번 달 특이사항 없음</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">특이사항</h2>
      <Card>
        <CardContent className="pt-4">
          <ul className="divide-y divide-gray-100">
            {specialNotes.map((note, index) => (
              <li key={`${note.date}-${index}`} className="flex items-start gap-3 py-3">
                <NoteTypeBadge type={note.type} />
                <span className="text-sm text-gray-500 min-w-16">
                  {format(parseISO(note.date), 'MM/dd (EEE)', { locale: ko })}
                </span>
                <span className="text-sm text-gray-700">{note.description}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

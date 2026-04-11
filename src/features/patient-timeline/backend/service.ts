import type { SupabaseClient } from '@supabase/supabase-js';
import { format, parseISO, isValid } from 'date-fns';
import type { Database } from '@/lib/supabase/types';
import type { PatientTimelineResponse, TimelineEvent } from './schema';
import { PatientTimelineError, PatientTimelineErrorCode } from './error';

type DB = SupabaseClient<Database>;

interface PatientRow {
  id: string;
  created_at: string;
  birth_date: string | null;
  status: string;
  updated_at: string;
}

interface BuildInput {
  patient: PatientRow;
  attendances: { date: string }[];
  scheduledAttendances: { date: string }[];
  consultations: { date: string }[];
  messages: { created_at: string }[];
  today: Date;
}

export function buildTimelineEvents(input: BuildInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const { patient, attendances, scheduledAttendances, consultations, messages, today } = input;

  const admissionDate = patient.created_at.slice(0, 10);
  events.push({ date: admissionDate, type: 'admission', label: '입원' });

  const attendedSet = new Set(attendances.map((a) => a.date));
  for (const a of attendances) {
    events.push({ date: a.date, type: 'attendance', label: '출석' });
  }

  for (const s of scheduledAttendances) {
    if (!attendedSet.has(s.date)) {
      events.push({ date: s.date, type: 'absence', label: '결석' });
    }
  }

  for (const c of consultations) {
    events.push({ date: c.date, type: 'consultation', label: '진찰' });
  }

  for (const m of messages) {
    events.push({ date: m.created_at.slice(0, 10), type: 'message', label: '메시지' });
  }

  if (patient.birth_date) {
    const birth = parseISO(patient.birth_date);
    if (isValid(birth)) {
      const admissionYear = parseISO(admissionDate).getFullYear();
      const todayYear = today.getFullYear();
      const todayStr = format(today, 'yyyy-MM-dd');
      for (let y = admissionYear; y <= todayYear; y++) {
        const birthday = new Date(y, birth.getMonth(), birth.getDate());
        const dateStr = format(birthday, 'yyyy-MM-dd');
        if (dateStr >= admissionDate && dateStr <= todayStr) {
          events.push({ date: dateStr, type: 'birthday', label: '생일' });
        }
      }
    }
  }

  if (patient.status === 'discharged') {
    events.push({
      date: patient.updated_at.slice(0, 10),
      type: 'discharge',
      label: '퇴원',
    });
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return events;
}

export async function getPatientTimeline(
  supabase: DB,
  patientId: string,
  now: Date = new Date(),
): Promise<PatientTimelineResponse> {
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, created_at, birth_date, status, updated_at')
    .eq('id', patientId)
    .single();

  if (patientError || !patient) {
    throw new PatientTimelineError(
      PatientTimelineErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  const admissionDate = (patient.created_at as string).slice(0, 10);
  const todayStr = format(now, 'yyyy-MM-dd');

  const [{ data: attRows }, { data: schRows }, { data: consRows }, { data: msgRows }] =
    await Promise.all([
      supabase
        .from('attendances')
        .select('date')
        .eq('patient_id', patientId)
        .gte('date', admissionDate)
        .lte('date', todayStr),
      supabase
        .from('scheduled_attendances')
        .select('date, is_cancelled')
        .eq('patient_id', patientId)
        .eq('is_cancelled', false)
        .gte('date', admissionDate)
        .lte('date', todayStr),
      supabase
        .from('consultations')
        .select('date')
        .eq('patient_id', patientId)
        .gte('date', admissionDate)
        .lte('date', todayStr),
      supabase
        .from('messages')
        .select('created_at')
        .eq('patient_id', patientId)
        .gte('created_at', admissionDate)
        .lte('created_at', todayStr + 'T23:59:59Z'),
    ]);

  const events = buildTimelineEvents({
    patient: patient as unknown as PatientRow,
    attendances: (attRows ?? []) as { date: string }[],
    scheduledAttendances: (schRows ?? []) as { date: string }[],
    consultations: (consRows ?? []) as { date: string }[],
    messages: (msgRows ?? []) as { created_at: string }[],
    today: now,
  });

  return {
    patientId,
    range: { startDate: admissionDate, endDate: todayStr },
    events,
  };
}

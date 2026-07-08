import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface SlackConsultationMessage {
  ts: string;
  text: string;
  user?: string;
  username?: string;
  thread_ts?: string;
}

interface DoctorRow {
  id: string;
  name: string;
}

interface PatientRow {
  id: string;
  name: string;
  display_name: string | null;
  room_number: string | null;
  doctor_id: string | null;
}

interface ExistingConsultationRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  note: string | null;
  has_task: boolean;
  task_content: string | null;
  task_target: Database['public']['Tables']['consultations']['Row']['task_target'];
  checked_by_coordinator: boolean;
}

export interface ParsedSlackConsultationEntry {
  patientName: string;
  note: string;
  doctorName: string | null;
  messageTs: string;
  threadTs: string | null;
  sourceUser: string | null;
  sourceTitle: string | null;
}

interface SlackConsultationParseOptions {
  date?: string;
}

export interface SlackConsultationIngestResult {
  parsedEntries: number;
  matchedEntries: number;
  attendanceCreated: number;
  attendanceAlreadyExists: number;
  consultationsCreated: number;
  consultationsUpdated: number;
  consultationsAlreadySynced: number;
  skippedNoPatientMatch: number;
  skippedAmbiguousPatient: number;
  skippedNoDoctor: number;
  skippedDbErrors: number;
}

const PATIENT_ENTRY_RE = /^\s*(?:[-•]\s*)?([가-힣]{2,4}[A-Z]?)\s*[:：]\s*(.*)$/;
const PARK_SEUNGHYUN_DIRECT_APP_RECORD_WEEKDAYS = new Set([1, 2, 3]);

const DOCTOR_ALIAS: Record<string, string> = {
  원장님: '박상운',
  박원장님: '박상운',
  박상운원장님: '박상운',
  박부원장님: '박명현',
  박명현부원장님: '박명현',
  권부원장님: '권도훈',
  권도훈부원장님: '권도훈',
  박승현부원장님: '박승현',
  이상철의국장님: '이상철',
  이상철원장님: '이상철',
  이신화과장님: '이신화',
  신정욱과장님: '신정욱',
};

function compact(value: string): string {
  return value.replace(/\s+/g, '');
}

function normalizeSlackText(text: string): string {
  return text
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\r\n/g, '\n');
}

function getCalendarWeekday(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
}

function shouldSkipSlackDoctorRecord(doctorName: string | null, date?: string): boolean {
  if (doctorName !== '박승현' || !date) return false;

  const weekday = getCalendarWeekday(date);
  if (weekday === null) return false;

  return PARK_SEUNGHYUN_DIRECT_APP_RECORD_WEEKDAYS.has(weekday);
}

function stripWrappingQuote(value: string): string {
  const trimmed = value.trim();
  const quotePairs: Array<[string, string]> = [
    ["'", "'"],
    ['"', '"'],
    ['“', '”'],
    ['‘', '’'],
  ];

  const pair = quotePairs.find(([open, close]) => trimmed.startsWith(open) && trimmed.endsWith(close));
  if (!pair || trimmed.length < 2) return trimmed;

  const [open, close] = pair;
  return trimmed.slice(open.length, trimmed.length - close.length).trim();
}

function titleFromMessage(text: string): string | null {
  const firstMeaningfulLine = normalizeSlackText(text)
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstMeaningfulLine) return null;
  if (firstMeaningfulLine.includes('진찰')) return firstMeaningfulLine.replace(/^\[|\]$/g, '');
  return null;
}

export function inferDoctorName(text: string, doctorNames: string[]): string | null {
  const normalized = compact(normalizeSlackText(text));

  for (const name of doctorNames) {
    if (normalized.includes(name)) return name;
  }

  for (const [alias, doctorName] of Object.entries(DOCTOR_ALIAS).sort((a, b) => b[0].length - a[0].length)) {
    if (normalized.includes(alias)) return doctorName;
  }

  return null;
}

export function parseSlackConsultationMessages(
  messages: SlackConsultationMessage[],
  doctorNames: string[],
  options: SlackConsultationParseOptions = {},
): ParsedSlackConsultationEntry[] {
  const entries: ParsedSlackConsultationEntry[] = [];

  for (const message of messages) {
    const text = normalizeSlackText(message.text || '');
    if (!text.includes('진찰')) continue;

    const doctorName = inferDoctorName(text, doctorNames);
    if (shouldSkipSlackDoctorRecord(doctorName, options.date)) continue;

    const sourceTitle = titleFromMessage(text);
    const lines = text.split('\n');
    let current: ParsedSlackConsultationEntry | null = null;

    const flush = () => {
      if (!current) return;
      const note = stripWrappingQuote(current.note);
      if (note.length === 0) return;
      entries.push({ ...current, note });
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const match = PATIENT_ENTRY_RE.exec(line);
      if (match) {
        flush();
        const patientName = match[1].trim();
        const body = match[2].trim();
        current = {
          patientName,
          note: body,
          doctorName,
          messageTs: message.ts,
          threadTs: message.thread_ts || null,
          sourceUser: message.user || message.username || null,
          sourceTitle,
        };
        continue;
      }

      if (current) {
        const continuation = line.trim();
        if (continuation.length > 0) {
          current.note += `\n${continuation}`;
        }
      }
    }

    flush();
  }

  return entries;
}

function patientLabels(patient: PatientRow): string[] {
  return [patient.name, patient.display_name].filter((value): value is string => !!value);
}

function resolvePatient(
  entry: ParsedSlackConsultationEntry,
  patients: PatientRow[],
  doctorId: string | null,
): { patient: PatientRow | null; ambiguous: boolean } {
  const normalizedEntryName = compact(entry.patientName);
  const exactMatches = patients.filter((patient) =>
    patientLabels(patient).some((label) => compact(label) === normalizedEntryName),
  );

  if (exactMatches.length === 0) return { patient: null, ambiguous: false };
  if (exactMatches.length === 1) return { patient: exactMatches[0], ambiguous: false };

  if (doctorId) {
    const doctorMatches = exactMatches.filter((patient) => patient.doctor_id === doctorId);
    if (doctorMatches.length === 1) return { patient: doctorMatches[0], ambiguous: false };
  }

  return { patient: null, ambiguous: true };
}

function buildSlackNote(entry: ParsedSlackConsultationEntry): string {
  return entry.note.trim();
}

function appendNote(existingNote: string | null, addition: string): string {
  if (!existingNote || existingNote.trim().length === 0) return addition;
  return `${existingNote.trim()}\n\n${addition}`;
}

function makeEmptyResult(parsedEntries = 0): SlackConsultationIngestResult {
  return {
    parsedEntries,
    matchedEntries: 0,
    attendanceCreated: 0,
    attendanceAlreadyExists: 0,
    consultationsCreated: 0,
    consultationsUpdated: 0,
    consultationsAlreadySynced: 0,
    skippedNoPatientMatch: 0,
    skippedAmbiguousPatient: 0,
    skippedNoDoctor: 0,
    skippedDbErrors: 0,
  };
}

export async function ingestSlackConsultations(
  supabase: SupabaseClient<Database>,
  params: {
    date: string;
    messages: SlackConsultationMessage[];
    checkedAt: string;
  },
): Promise<SlackConsultationIngestResult> {
  const { data: doctors, error: doctorsError } = await supabase
    .from('staff')
    .select('id, name')
    .eq('role', 'doctor')
    .eq('is_active', true);

  if (doctorsError) throw doctorsError;

  const doctorRows = (doctors || []) as DoctorRow[];
  const doctorNames = doctorRows.map((doctor) => doctor.name);
  const doctorIdByName = new Map(doctorRows.map((doctor) => [doctor.name, doctor.id]));
  const entries = parseSlackConsultationMessages(params.messages, doctorNames, { date: params.date });
  const result = makeEmptyResult(entries.length);

  if (entries.length === 0) return result;

  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, name, display_name, room_number, doctor_id')
    .eq('status', 'active');

  if (patientsError) throw patientsError;

  const patientRows = (patients || []) as PatientRow[];
  const matched: Array<{
    entry: ParsedSlackConsultationEntry;
    patient: PatientRow;
    doctorId: string;
    note: string;
  }> = [];

  for (const entry of entries) {
    const parsedDoctorId = entry.doctorName ? doctorIdByName.get(entry.doctorName) || null : null;
    if (!parsedDoctorId) {
      result.skippedNoDoctor++;
      continue;
    }

    const resolved = resolvePatient(entry, patientRows, parsedDoctorId);

    if (resolved.ambiguous) {
      result.skippedAmbiguousPatient++;
      continue;
    }
    if (!resolved.patient) {
      result.skippedNoPatientMatch++;
      continue;
    }

    matched.push({
      entry,
      patient: resolved.patient,
      doctorId: parsedDoctorId,
      note: buildSlackNote(entry),
    });
  }

  result.matchedEntries = matched.length;
  if (matched.length === 0) return result;

  const groupedByPatient = new Map<
    string,
    {
      patient: PatientRow;
      doctorId: string;
      notes: Array<{ entry: ParsedSlackConsultationEntry; note: string }>;
    }
  >();

  for (const item of matched) {
    const existing = groupedByPatient.get(item.patient.id);
    if (existing) {
      existing.notes.push({ entry: item.entry, note: item.note });
      continue;
    }

    groupedByPatient.set(item.patient.id, {
      patient: item.patient,
      doctorId: item.doctorId,
      notes: [{ entry: item.entry, note: item.note }],
    });
  }

  const groupedMatched = [...groupedByPatient.values()];
  const patientIds = groupedMatched.map((item) => item.patient.id);

  const [attendanceQuery, consultationQuery] = await Promise.all([
    supabase
      .from('attendances')
      .select('patient_id')
      .in('patient_id', patientIds)
      .eq('date', params.date),
    supabase
      .from('consultations')
      .select('id, patient_id, doctor_id, note, has_task, task_content, task_target, checked_by_coordinator')
      .in('patient_id', patientIds)
      .eq('date', params.date),
  ]);

  if (attendanceQuery.error) throw attendanceQuery.error;
  if (consultationQuery.error) throw consultationQuery.error;

  const attendedSet = new Set((attendanceQuery.data || []).map((row) => row.patient_id));
  const existingConsultationByPatient = new Map(
    ((consultationQuery.data || []) as ExistingConsultationRow[]).map((row) => [row.patient_id, row]),
  );

  const attendancesToCreate = patientIds
    .filter((patientId) => !attendedSet.has(patientId))
    .map((patientId) => ({
      patient_id: patientId,
      date: params.date,
      checked_at: params.checkedAt,
    }));

  result.attendanceAlreadyExists = patientIds.length - attendancesToCreate.length;

  if (attendancesToCreate.length > 0) {
    const { error } = await supabase
      .from('attendances')
      .upsert(attendancesToCreate, { onConflict: 'patient_id,date', ignoreDuplicates: true });
    if (error) {
      result.skippedDbErrors += attendancesToCreate.length;
    } else {
      result.attendanceCreated = attendancesToCreate.length;
    }
  }

  for (const item of groupedMatched) {
    const existing = existingConsultationByPatient.get(item.patient.id);
    const unsyncedNotes = item.notes.filter(
      ({ note }) => !(existing?.note || '').includes(note.trim()),
    );

    if (unsyncedNotes.length === 0) {
      result.consultationsAlreadySynced += item.notes.length;
      continue;
    }

    const noteToAppend = unsyncedNotes.map(({ note }) => note).join('\n\n');
    const latestDoctorId = unsyncedNotes.at(-1)?.entry.doctorName
      ? doctorIdByName.get(unsyncedNotes.at(-1)?.entry.doctorName || '') || item.doctorId
      : item.doctorId;

    if (!existing) {
      const { error } = await supabase.from('consultations').insert({
        patient_id: item.patient.id,
        doctor_id: latestDoctorId,
        date: params.date,
        note: noteToAppend,
        has_task: false,
        checked_by_coordinator: true,
      });

      if (error) {
        result.skippedDbErrors++;
      } else {
        result.consultationsCreated++;
      }
      continue;
    }

    const { error } = await supabase
      .from('consultations')
      .update({
        note: appendNote(existing.note, noteToAppend),
        doctor_id: existing.checked_by_coordinator ? latestDoctorId : existing.doctor_id,
        checked_by_coordinator: existing.checked_by_coordinator,
        has_task: existing.has_task,
        task_content: existing.task_content,
        task_target: existing.task_target,
      })
      .eq('id', existing.id);

    if (error) {
      result.skippedDbErrors++;
    } else {
      result.consultationsUpdated++;
      result.consultationsAlreadySynced += item.notes.length - unsyncedNotes.length;
    }
  }

  return result;
}

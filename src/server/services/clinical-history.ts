import type { ClinicalHistoryLookup, PersonalHistory } from '@/features/doctor/backend/schema';

export interface ClinicalHistoryConfig {
  apiUrl: string;
  apiKey: string;
}

interface ClinicalHistoryRow {
  summary_text: string | null;
  onset_text: string | null;
  course_text: string | null;
  current_text: string | null;
  full_markdown: string | null;
  source_generated_at: string | null;
  source_captured_at: string | null;
}

const SELECT_FIELDS = [
  'summary_text',
  'onset_text',
  'course_text',
  'current_text',
  'full_markdown',
  'source_generated_at',
  'source_captured_at',
].join(',');

function normalizedPatientIdNo(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits ? digits.replace(/^0+/, '') || '0' : value.trim();
}

function toPersonalHistory(row: ClinicalHistoryRow): PersonalHistory {
  return {
    summary_text: row.summary_text ?? '',
    onset_text: row.onset_text ?? '',
    course_text: row.course_text ?? '',
    current_text: row.current_text ?? '',
    full_markdown: row.full_markdown ?? '',
    updated_at: row.source_generated_at ?? row.source_captured_at,
  };
}

async function fetchCurrentHistory(
  config: ClinicalHistoryConfig,
  patientIdNo: string,
): Promise<ClinicalHistoryRow | null> {
  const url = new URL('/rest/v1/patient_clinical_history_versions', config.apiUrl);
  url.searchParams.set('select', SELECT_FIELDS);
  url.searchParams.set('patient_id_no', `eq.${patientIdNo}`);
  url.searchParams.set('is_current', 'eq.true');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`clinical history lookup failed: ${response.status}`);
  }

  const rows = await response.json() as ClinicalHistoryRow[];
  return rows[0] ?? null;
}

export async function getClinicalHistoryByPatientIdNo(
  config: ClinicalHistoryConfig | undefined,
  patientIdNo: string | null,
): Promise<ClinicalHistoryLookup> {
  if (!config) {
    return { status: 'unavailable', history: null };
  }
  if (!patientIdNo?.trim()) {
    return { status: 'not_found', history: null };
  }

  try {
    const rawId = patientIdNo.trim();
    const normalizedId = normalizedPatientIdNo(rawId);
    const rawMatch = await fetchCurrentHistory(config, rawId);
    const row = rawMatch ?? (
      normalizedId !== rawId
        ? await fetchCurrentHistory(config, normalizedId)
        : null
    );

    if (!row) {
      return { status: 'not_found', history: null };
    }

    return { status: 'available', history: toPersonalHistory(row) };
  } catch {
    return { status: 'unavailable', history: null };
  }
}

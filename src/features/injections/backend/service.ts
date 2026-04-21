import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import {
  fetchInjectionsByPatientNumber,
  fetchUpcomingInjections,
} from '@/server/integrations/carescheduler/client';
import { InjectionsError, InjectionsErrorCode } from './error';
import type { PatientInjectionsResponse, UpcomingInjectionsResponse } from './schema';

type DB = SupabaseClient<Database>;

const DEFAULT_UPCOMING_DAYS = 7;
const MAX_UPCOMING_DAYS = 60;

export async function getPatientInjections(
  supabase: DB,
  patientId: string,
): Promise<PatientInjectionsResponse> {
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, patient_id_no')
    .eq('id', patientId)
    .maybeSingle();

  if (patientError) {
    throw new InjectionsError(
      InjectionsErrorCode.PATIENT_NOT_FOUND,
      `환자 조회 실패: ${patientError.message}`,
    );
  }

  if (!patient) {
    throw new InjectionsError(
      InjectionsErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다.',
    );
  }

  const patientRow = patient as { id: string; patient_id_no: string | null };

  if (!patientRow.patient_id_no) {
    throw new InjectionsError(
      InjectionsErrorCode.MISSING_PATIENT_ID_NO,
      '환자에게 병록번호(IDNO)가 등록되어 있지 않습니다.',
    );
  }

  const result = await fetchInjectionsByPatientNumber(patientRow.patient_id_no);

  if (!result.ok) {
    return {
      patient_id: patientRow.id,
      patient_id_no: patientRow.patient_id_no,
      patient_name: null,
      injections: [],
      upstream_available: false,
    };
  }

  return {
    patient_id: patientRow.id,
    patient_id_no: patientRow.patient_id_no,
    patient_name: result.data.patient_name,
    injections: result.data.injections,
    upstream_available: true,
  };
}

export async function getUpcomingInjections(
  supabase: DB,
  params: { days?: number },
): Promise<UpcomingInjectionsResponse> {
  const days = Math.min(
    Math.max(params.days ?? DEFAULT_UPCOMING_DAYS, 1),
    MAX_UPCOMING_DAYS,
  );

  const result = await fetchUpcomingInjections({ days });

  if (!result.ok) {
    const now = new Date();
    const fromIso = now.toISOString().slice(0, 10);
    const toDate = new Date(now);
    toDate.setUTCDate(toDate.getUTCDate() + days - 1);
    const toIso = toDate.toISOString().slice(0, 10);

    return {
      from: fromIso,
      to: toIso,
      count: 0,
      items: [],
      upstream_available: false,
    };
  }

  const upstream = result.data;

  if (upstream.items.length === 0) {
    return {
      from: upstream.from,
      to: upstream.to,
      count: 0,
      items: [],
      upstream_available: true,
    };
  }

  const patientNumbers = Array.from(
    new Set(upstream.items.map((item) => item.patient_number)),
  );

  const { data: patientRows, error: patientsError } = await supabase
    .from('patients')
    .select('id, patient_id_no')
    .in('patient_id_no', patientNumbers);

  if (patientsError) {
    throw new InjectionsError(
      InjectionsErrorCode.PATIENT_NOT_FOUND,
      `Daycare 환자 매핑 조회 실패: ${patientsError.message}`,
    );
  }

  const idByPatientNumber = new Map<string, string>();
  for (const row of (patientRows ?? []) as Array<{
    id: string;
    patient_id_no: string | null;
  }>) {
    if (row.patient_id_no) {
      idByPatientNumber.set(row.patient_id_no, row.id);
    }
  }

  const items = upstream.items.map((item) => ({
    patient_id: idByPatientNumber.get(item.patient_number) ?? null,
    patient_id_no: item.patient_number,
    patient_name: item.patient_name,
    item_name: item.item_name,
    interval_weeks: item.interval_weeks,
    last_executed_date: item.last_executed_date,
    next_due_date: item.next_due_date,
  }));

  return {
    from: upstream.from,
    to: upstream.to,
    count: items.length,
    items,
    upstream_available: true,
  };
}

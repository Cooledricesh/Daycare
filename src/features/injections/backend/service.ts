import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { fetchInjectionsByPatientNumber } from '@/server/integrations/carescheduler/client';
import { InjectionsError, InjectionsErrorCode } from './error';
import type { PatientInjectionsResponse } from './schema';

type DB = SupabaseClient<Database>;

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

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  SearchQueryParams,
  CreateAttendanceRequest,
  CheckAttendanceParams,
  CreateVitalsRequest,
  Patient,
  Attendance,
  Vitals,
  CheckAttendanceResult,
} from './schema';
import { PatientError, PatientErrorCode } from './error';

/**
 * 환자 검색 (이름 기반 자동완성)
 */
export async function searchPatients(
  supabase: SupabaseClient<Database>,
  params: SearchQueryParams,
): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, name')
    .eq('status', 'active')
    .ilike('name', `${params.q}%`)
    .order('name')
    .limit(10);

  if (error) {
    throw new PatientError(
      PatientErrorCode.INVALID_SEARCH_QUERY,
      `환자 검색에 실패했습니다: ${error.message}`,
    );
  }

  if (!data) {
    return [];
  }

  return data.map((patient: { id: string; name: string }) => ({
    id: patient.id,
    name: patient.name,
  }));
}

/**
 * 출석 기록 생성
 */
export async function createAttendance(
  supabase: SupabaseClient<Database>,
  request: CreateAttendanceRequest,
): Promise<Attendance> {
  // 이미 출석했는지 확인
  const { data: existing } = await supabase
    .from('attendances')
    .select('id')
    .eq('patient_id', request.patient_id)
    .eq('date', request.date)
    .single();

  if (existing) {
    throw new PatientError(
      PatientErrorCode.ALREADY_ATTENDED,
      '이미 출석하셨습니다',
    );
  }

  // 출석 기록 생성
  const insertData = {
    patient_id: request.patient_id,
    date: request.date,
    checked_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('attendances')
    .insert([insertData] as any)
    .select('id, patient_id, date, checked_at')
    .single();

  if (error || !data) {
    throw new PatientError(
      PatientErrorCode.ATTENDANCE_SAVE_FAILED,
      `출석 체크에 실패했습니다: ${error?.message || '알 수 없는 오류'}`,
    );
  }

  return data as Attendance;
}

/**
 * 출석 여부 확인
 */
export async function checkAttendance(
  supabase: SupabaseClient<Database>,
  params: CheckAttendanceParams,
): Promise<CheckAttendanceResult> {
  const { data, error } = await supabase
    .from('attendances')
    .select('id')
    .eq('patient_id', params.patient_id)
    .eq('date', params.date)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116: no rows returned (정상)
    throw new Error(`출석 여부 확인에 실패했습니다: ${error.message}`);
  }

  return {
    is_attended: !!data,
  };
}

/**
 * 활력징후 기록 생성/업데이트
 */
export async function createVitals(
  supabase: SupabaseClient<Database>,
  request: CreateVitalsRequest,
): Promise<Vitals> {
  const insertData = {
    patient_id: request.patient_id,
    date: request.date,
    systolic: request.systolic ?? null,
    diastolic: request.diastolic ?? null,
    blood_sugar: request.blood_sugar ?? null,
    memo: request.memo ?? null,
    recorded_at: new Date().toISOString(),
  };

  const { data, error} = await supabase
    .from('vitals')
    .upsert([insertData] as any, {
      onConflict: 'patient_id,date',
    })
    .select('id, patient_id, date, systolic, diastolic, blood_sugar, memo, recorded_at')
    .single();

  if (error || !data) {
    throw new PatientError(
      PatientErrorCode.VITALS_SAVE_FAILED,
      `활력징후 저장에 실패했습니다: ${error?.message || '알 수 없는 오류'}`,
    );
  }

  return data as Vitals;
}

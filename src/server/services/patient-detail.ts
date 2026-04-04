import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type TaskCompletionRow = Database['public']['Tables']['task_completions']['Row'];

export interface PatientDayDetail {
  attendance: { checked_at: string } | null;
  consultation: {
    id: string;
    note: string | null;
    has_task: boolean;
    task_content: string | null;
    task_target: string | null;
    task_completions: Pick<TaskCompletionRow, 'id' | 'is_completed' | 'completed_at' | 'memo' | 'role'>[];
  } | null;
  vitals: {
    systolic: number | null;
    diastolic: number | null;
    blood_sugar: number | null;
  } | null;
}

/** consultation select result for patient day detail */
interface ConsultationDetailResult {
  id: string;
  note: string | null;
  has_task: boolean;
  task_content: string | null;
  task_target: string | null;
  task_completions: Pick<TaskCompletionRow, 'id' | 'is_completed' | 'completed_at' | 'memo' | 'role'>[];
}

/**
 * 특정 환자의 특정 날짜 상세 정보를 조회한다.
 * Staff, Doctor, Nurse에서 공통으로 사용.
 */
export async function getPatientDayDetail(
  supabase: SupabaseClient<Database>,
  patientId: string,
  date: string,
): Promise<PatientDayDetail> {
  const [
    { data: attendance },
    { data: consultation },
    { data: vitals },
  ] = await Promise.all([
    supabase
      .from('attendances')
      .select('checked_at')
      .eq('patient_id', patientId)
      .eq('date', date)
      .maybeSingle(),
    supabase
      .from('consultations')
      .select('id, note, has_task, task_content, task_target, task_completions(id, is_completed, completed_at, memo, role)')
      .eq('patient_id', patientId)
      .eq('date', date)
      .returns<ConsultationDetailResult[]>()
      .maybeSingle(),
    supabase
      .from('vitals')
      .select('systolic, diastolic, blood_sugar')
      .eq('patient_id', patientId)
      .eq('date', date)
      .maybeSingle(),
  ]);

  return { attendance, consultation, vitals };
}

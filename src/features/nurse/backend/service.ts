import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  GetPrescriptionsParams,
  GetNursePatientsParams,
  CompleteTaskRequest,
  CreateMessageRequest,
  PrescriptionItem,
  NursePatientSummary,
  TaskCompletion,
  Message,
} from './schema';
import { NurseError, NurseErrorCode } from './error';

interface NursePatientRow {
  id: string;
  name: string;
  display_name: string | null;
  gender: string | null;
  coordinator: { name: string } | null;
}

interface ConsultationJoinRow {
  id: string;
  patient_id: string;
  note: string | null;
  has_task: boolean;
  task_content: string | null;
  task_target: string | null;
  staff: { name: string } | null;
  task_completions: { id: string; is_completed: boolean; completed_at: string | null; role: string }[];
}

interface PrescriptionConsultationRow extends ConsultationJoinRow {
  created_at: string;
  patients: { name: string; coordinator_id: string | null };
}
import { ensureScheduleGenerated } from '@/server/services/schedule';
import {
  completeTask as completeTaskShared,
} from '@/server/services/task';
import {
  createMessage as createMessageShared,
  deleteMessage as deleteMessageShared,
  updateMessage as updateMessageShared,
} from '@/server/services/message';
import { getTodayString } from '@/lib/date';

/**
 * 간호사 환자 목록 조회 (전체 활성 환자)
 */
export async function getNursePatients(
  supabase: SupabaseClient<Database>,
  params: GetNursePatientsParams,
): Promise<NursePatientSummary[]> {
  const date = params.date || getTodayString();

  // 1. 모든 활성 환자 조회
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, name, display_name, gender, coordinator:staff!patients_coordinator_id_fkey(name)')
    .eq('status', 'active')
    .order('name')
    .returns<NursePatientRow[]>();

  if (patientsError) {
    throw new NurseError(
      NurseErrorCode.INVALID_REQUEST,
      `환자 목록 조회에 실패했습니다: ${patientsError.message}`,
    );
  }

  const patientIds = (patients || []).map((p) => p.id);
  if (patientIds.length === 0) return [];

  // 오늘 스케줄이 없으면 패턴에서 자동 생성
  await ensureScheduleGenerated(supabase, date);

  // 2+3. 출석 + 진료 기록 + 출석예정을 병렬로 조회
  const [
    { data: attendances },
    { data: consultations },
    { data: scheduledAttendances },
  ] = await Promise.all([
    supabase.from('attendances')
      .select('patient_id, checked_at')
      .in('patient_id', patientIds)
      .eq('date', date)
      .returns<{ patient_id: string; checked_at: string }[]>(),
    supabase.from('consultations')
      .select(`
        id,
        patient_id,
        note,
        has_task,
        task_content,
        task_target,
        staff!consultations_doctor_id_fkey(name),
        task_completions(id, is_completed, completed_at, role)
      `)
      .in('patient_id', patientIds)
      .eq('date', date)
      .returns<ConsultationJoinRow[]>(),
    supabase.from('scheduled_attendances')
      .select('patient_id')
      .eq('date', date)
      .eq('is_cancelled', false)
      .in('patient_id', patientIds)
      .returns<{ patient_id: string }[]>(),
  ]);

  // 4. Map 생성
  const attendanceMap = new Map(
    (attendances || []).map((a) => [a.patient_id, a] as const),
  );
  const consultationMap = new Map(
    (consultations || []).map((c) => [c.patient_id, c] as const),
  );
  const scheduledSet = new Set(
    (scheduledAttendances || []).map((s) => s.patient_id),
  );

  // 5. 데이터 변환
  const hasNurseTask = (c: ConsultationJoinRow | undefined) => !!c?.has_task;

  const items: NursePatientSummary[] = (patients || []).map((p) => {
    const attendance = attendanceMap.get(p.id);
    const consultation = consultationMap.get(p.id);
    const anyTaskCompletion = consultation?.task_completions?.find(
      (tc) => tc.is_completed,
    );

    return {
      id: p.id,
      name: p.name,
      display_name: null,
      gender: p.gender || null,
      coordinator_name: p.coordinator?.name || null,
      is_attended: !!attendance,
      attendance_time: attendance?.checked_at || null,
      is_scheduled: scheduledSet.has(p.id),
      is_consulted: !!consultation,
      has_nurse_task: hasNurseTask(consultation),
      task_content: consultation?.task_content || null,
      task_completed: hasNurseTask(consultation)
        ? (anyTaskCompletion?.is_completed || false)
        : false,
      consultation_id: consultation?.id || null,
      task_completion_id: anyTaskCompletion?.id || null,
      doctor_name: consultation?.staff?.name || null,
      note: consultation?.note || null,
    };
  });

  // 6. 필터 적용
  if (params.filter === 'pending') {
    return items.filter((item) => item.has_nurse_task && !item.task_completed);
  }
  if (params.filter === 'completed') {
    return items.filter((item) => !item.has_nurse_task || item.task_completed);
  }
  return items;
}

/**
 * 처방 변경 목록 조회
 */
export async function getPrescriptions(
  supabase: SupabaseClient<Database>,
  params: GetPrescriptionsParams,
): Promise<PrescriptionItem[]> {
  const date = params.date || getTodayString();

  // 오늘 모든 진료 기록 조회 (간호사가 투약 변경/진료 메모 확인용)
  const query = supabase
    .from('consultations')
    .select(`
      id,
      patient_id,
      note,
      has_task,
      task_content,
      task_target,
      created_at,
      patients!inner(name, coordinator_id),
      staff!consultations_doctor_id_fkey(name),
      task_completions(id, is_completed, completed_at, role)
    `)
    .eq('date', date)
    .returns<PrescriptionConsultationRow[]>();

  const { data, error } = await query;

  if (error) {
    throw new NurseError(
      NurseErrorCode.INVALID_REQUEST,
      `처방 변경 목록 조회에 실패했습니다: ${error.message}`,
    );
  }

  if (!data) {
    return [];
  }

  // 데이터 변환 및 필터링
  const hasNurseTask = (c: PrescriptionConsultationRow) => !!c.has_task;

  const items: PrescriptionItem[] = (data || [])
    .map((c) => {
      const anyTaskCompletion = c.task_completions?.find(
        (tc) => tc.is_completed,
      );

      return {
        consultation_id: c.id,
        patient_id: c.patient_id,
        patient_name: c.patients?.name || '알 수 없음',
        coordinator_name: null,
        doctor_name: c.staff?.name || '알 수 없음',
        note: c.note || null,
        has_task: hasNurseTask(c),
        task_content: c.task_content || '',
        is_completed: hasNurseTask(c)
          ? (anyTaskCompletion?.is_completed || false)
          : true, // 지시사항이 없으면 완료 처리
        completed_at: anyTaskCompletion?.completed_at || null,
        task_completion_id: anyTaskCompletion?.id || null,
        created_at: c.created_at,
      };
    })
    .filter((item) => {
      if (params.filter === 'pending') {
        return !item.is_completed;
      }
      if (params.filter === 'completed') {
        return item.is_completed;
      }
      return true; // 'all'
    });

  return items;
}

/**
 * 지시사항 처리 완료
 */
export async function completeTask(
  supabase: SupabaseClient<Database>,
  staffId: string,
  params: CompleteTaskRequest,
): Promise<TaskCompletion> {
  return completeTaskShared(supabase, staffId, 'nurse', {
    consultation_id: params.consultation_id,
    memo: params.memo,
    mapError: (err) => {
      const codeMap: Record<string, NurseErrorCode> = {
        TASK_NOT_FOUND: NurseErrorCode.TASK_NOT_FOUND,
        TASK_ALREADY_COMPLETED: NurseErrorCode.TASK_ALREADY_COMPLETED,
        TASK_UPDATE_FAILED: NurseErrorCode.INVALID_REQUEST,
      };
      return new NurseError(codeMap[err.code] ?? NurseErrorCode.INVALID_REQUEST, err.message);
    },
  });
}

/**
 * 전달사항 작성
 */
export async function createMessage(
  supabase: SupabaseClient<Database>,
  staffId: string,
  params: CreateMessageRequest,
): Promise<Message> {
  return createMessageShared(supabase, staffId, 'nurse', {
    patient_id: params.patient_id,
    date: params.date,
    content: params.content,
  }, {
    mapError: (err) => new NurseError(NurseErrorCode.MESSAGE_SAVE_FAILED, err.message),
  });
}

/**
 * 전달사항 삭제
 */
export async function deleteMessage(
  supabase: SupabaseClient<Database>,
  staffId: string,
  messageId: string,
  isAdmin = false,
): Promise<void> {
  await deleteMessageShared(supabase, messageId, staffId, isAdmin, {
    mapError: (err) => new NurseError(NurseErrorCode.MESSAGE_DELETE_FAILED, err.message),
  });
}

/**
 * 전달사항 수정
 */
export async function updateMessage(
  supabase: SupabaseClient<Database>,
  staffId: string,
  messageId: string,
  content: string,
  isAdmin = false,
): Promise<void> {
  await updateMessageShared(supabase, messageId, staffId, isAdmin, { content }, {
    mapError: (err) => new NurseError(NurseErrorCode.MESSAGE_UPDATE_FAILED, err.message),
  });
}

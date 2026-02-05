import { z } from 'zod';

// 지시사항 조회 파라미터
export const GetTasksParamsSchema = z.object({
  date: z.string().optional(), // YYYY-MM-DD, 기본값: 오늘
  status: z.enum(['all', 'pending', 'completed']).optional().default('all'),
});

export type GetTasksParams = z.infer<typeof GetTasksParamsSchema>;

// 환자 히스토리 조회 파라미터
export const GetPatientHistoryParamsSchema = z.object({
  patient_id: z.string().uuid(),
  months: z.number().int().min(1).max(12).optional().default(1),
});

export type GetPatientHistoryParams = z.infer<typeof GetPatientHistoryParamsSchema>;

// 메시지 읽음 처리 요청
export const MarkMessageReadRequestSchema = z.object({
  message_id: z.string().uuid(),
});

export type MarkMessageReadRequest = z.infer<typeof MarkMessageReadRequestSchema>;

// 지시사항 항목
export interface TaskItem {
  consultation_id: string;
  patient_id: string;
  patient_name: string;
  room_number: string | null;
  coordinator_name: string | null;
  task_content: string;
  task_target: 'coordinator' | 'nurse' | 'both';
  created_at: string;
  coordinator_completed: boolean;
  coordinator_completed_at: string | null;
  nurse_completed: boolean;
  nurse_completed_at: string | null;
}

// 환자 기본 정보
export interface PatientBasicInfo {
  id: string;
  name: string;
  gender: 'M' | 'F' | null;
  room_number: string | null;
  coordinator_name: string | null;
  doctor_name: string | null;
}

// 진찰 기록
export interface ConsultationRecord {
  id: string;
  date: string;
  doctor_name: string;
  note: string | null;
  has_task: boolean;
  task_content: string | null;
  task_target: 'coordinator' | 'nurse' | 'both' | null;
}

// 전달사항 기록
export interface MessageRecord {
  id: string;
  date: string;
  author_name: string;
  author_role: 'coordinator' | 'nurse';
  content: string;
  is_read: boolean;
  created_at: string;
}

// 활력징후 기록
export interface VitalsRecord {
  date: string;
  systolic: number | null;
  diastolic: number | null;
  blood_sugar: number | null;
}

// 환자 히스토리 응답
export interface PatientHistory {
  patient: PatientBasicInfo;
  consultations: ConsultationRecord[];
  messages: MessageRecord[];
  vitals: VitalsRecord[];
}

// 오늘 메시지 목록
export interface TodayMessage {
  id: string;
  patient_id: string;
  patient_name: string;
  author_name: string;
  author_role: 'coordinator' | 'nurse';
  content: string;
  is_read: boolean;
  created_at: string;
}

// 대기 환자 조회 파라미터
export const GetWaitingPatientsParamsSchema = z.object({
  date: z.string().optional(), // YYYY-MM-DD, 기본값: 오늘
});

export type GetWaitingPatientsParams = z.infer<typeof GetWaitingPatientsParamsSchema>;

// 대기 환자 항목
export interface WaitingPatient {
  id: string;
  name: string;
  gender: 'M' | 'F' | null;
  room_number: string | null;
  coordinator_name: string | null;
  checked_at: string | null;  // null이면 아직 출석 안 함
  vitals: {
    systolic: number | null;
    diastolic: number | null;
    blood_sugar: number | null;
  } | null;
  has_consultation: boolean;
}

// 진찰 기록 생성 요청
export const CreateConsultationRequestSchema = z.object({
  patient_id: z.string().uuid(),
  date: z.string().optional(), // YYYY-MM-DD, 기본값: 오늘
  note: z.string().optional(),
  has_task: z.boolean().optional().default(false),
  task_content: z.string().optional(),
  task_target: z.enum(['coordinator', 'nurse', 'both']).optional(),
});

export type CreateConsultationRequest = z.infer<typeof CreateConsultationRequestSchema>;

// 생성된 진찰 기록
export interface CreatedConsultation {
  id: string;
  patient_id: string;
  date: string;
  doctor_id: string;
  note: string | null;
  has_task: boolean;
  task_content: string | null;
  task_target: 'coordinator' | 'nurse' | 'both' | null;
  created_at: string;
}

// 환자별 메시지 조회 파라미터
export const GetPatientMessagesParamsSchema = z.object({
  patient_id: z.string().uuid(),
  date: z.string().optional(), // YYYY-MM-DD, 기본값: 오늘
});

export type GetPatientMessagesParams = z.infer<typeof GetPatientMessagesParamsSchema>;

// 환자별 메시지 (의사용)
export interface PatientMessage {
  id: string;
  author_name: string;
  author_role: 'coordinator' | 'nurse';
  content: string;
  is_read: boolean;
  created_at: string;
}

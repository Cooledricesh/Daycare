import { z } from 'zod';

// 처방 변경 목록 조회 스키마
export const getPrescriptionsSchema = z.object({
  date: z.string().optional(),
  filter: z.enum(['all', 'pending', 'completed']).optional(),
});

export type GetPrescriptionsParams = z.infer<typeof getPrescriptionsSchema>;

// 지시사항 처리 완료 스키마
export const completeTaskSchema = z.object({
  consultation_id: z.string().uuid(),
  memo: z.string().optional(),
});

export type CompleteTaskRequest = z.infer<typeof completeTaskSchema>;

// 전달사항 작성 스키마
export const createMessageSchema = z.object({
  patient_id: z.string().uuid(),
  date: z.string(),
  content: z.string().min(1, '내용을 입력해주세요'),
});

export type CreateMessageRequest = z.infer<typeof createMessageSchema>;

// 응답 타입
export type PrescriptionItem = {
  consultation_id: string;
  patient_id: string;
  patient_name: string;
  coordinator_name: string | null;
  doctor_name: string;
  note: string | null;
  has_task: boolean;
  task_content: string;
  is_completed: boolean;
  completed_at: string | null;
  task_completion_id: string | null;
  created_at: string;
};

export type TaskCompletion = {
  id: string;
  consultation_id: string;
  is_completed: boolean;
  completed_at: string | null;
  memo: string | null;
};

export type Message = {
  id: string;
  patient_id: string;
  date: string;
  content: string;
  created_at: string;
};

// 간호사 환자 목록 조회 스키마
export const getNursePatientsSchema = z.object({
  date: z.string().optional(),
  filter: z.enum(['all', 'pending', 'completed']).optional(),
});

export type GetNursePatientsParams = z.infer<typeof getNursePatientsSchema>;

// 간호사용 환자 요약 타입
export type NursePatientSummary = {
  id: string;
  name: string;
  is_attended: boolean;
  attendance_time: string | null;
  is_consulted: boolean;
  has_nurse_task: boolean;
  task_content: string | null;
  task_completed: boolean;
  consultation_id: string | null;
  task_completion_id: string | null;
  doctor_name: string | null;
  note: string | null;
};

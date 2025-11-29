import { z } from 'zod';

// 담당 환자 목록 조회 스키마
export const getMyPatientsSchema = z.object({
  date: z.string().optional(),
});

export type GetMyPatientsParams = z.infer<typeof getMyPatientsSchema>;

// 환자 상세 조회 스키마
export const getPatientDetailSchema = z.object({
  patient_id: z.string().uuid(),
  date: z.string().optional(),
});

export type GetPatientDetailParams = z.infer<typeof getPatientDetailSchema>;

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
export type PatientSummary = {
  id: string;
  name: string;
  is_attended: boolean;
  attendance_time: string | null;
  is_consulted: boolean;
  has_task: boolean;
  task_content: string | null;
  task_completed: boolean;
  unread_message_count: number;
};

export type PatientDetail = {
  id: string;
  name: string;
  birth_date: string | null;
  gender: string | null;
  attendance: {
    is_attended: boolean;
    checked_at: string | null;
  };
  consultation: {
    is_consulted: boolean;
    note: string | null;
    has_task: boolean;
    task_content: string | null;
    task_target: string | null;
    consultation_id: string | null;
    task_completion_id: string | null;
    is_task_completed: boolean;
  };
  vitals: {
    systolic: number | null;
    diastolic: number | null;
    blood_sugar: number | null;
  } | null;
  recent_consultations: Array<{
    date: string;
    note: string | null;
    doctor_name: string;
  }>;
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

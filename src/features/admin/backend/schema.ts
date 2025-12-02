import { z } from 'zod';

// ========== Patients API Schemas ==========

export const getPatientsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
  search: z.string().optional(),
  status: z.enum(['active', 'discharged', 'suspended', 'all']).default('all'),
  coordinator_id: z.string().uuid().optional(),
});

export const createPatientSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이하이어야 합니다'),
  gender: z.enum(['M', 'F']).optional(),
  room_number: z.string().max(10, '호실은 10자 이하이어야 합니다').optional().or(z.literal('')),
  patient_id_no: z.string().max(20, '병록번호는 20자 이하이어야 합니다').optional().or(z.literal('')),
  coordinator_id: z.string().uuid('올바른 담당 코디를 선택해주세요').optional().or(z.literal('')),
  doctor_id: z.string().uuid('올바른 주치의를 선택해주세요').optional().or(z.literal('')),
  memo: z.string().max(500, '메모는 500자 이하이어야 합니다').optional(),
  schedule_days: z.array(z.number().min(0).max(6)),
});

export const updatePatientSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  gender: z.enum(['M', 'F']).optional(),
  room_number: z.string().max(10).optional().or(z.literal('')),
  patient_id_no: z.string().max(20).optional().or(z.literal('')),
  coordinator_id: z.string().uuid().optional().or(z.literal('')),
  doctor_id: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(['active', 'discharged', 'suspended']).optional(),
  memo: z.string().max(500).optional(),
  schedule_days: z.array(z.number().min(0).max(6)).optional(),
});

// ========== Staff API Schemas ==========

export const getStaffQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
  role: z.enum(['doctor', 'coordinator', 'nurse', 'admin', 'all']).default('all'),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});

export const createStaffSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이하이어야 합니다'),
  login_id: z.string()
    .min(4, '로그인 ID는 4자 이상이어야 합니다')
    .max(50, '로그인 ID는 50자 이하이어야 합니다')
    .regex(/^[a-zA-Z0-9_]+$/, '영문, 숫자, _만 사용 가능합니다'),
  password: z.string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(100, '비밀번호는 100자 이하이어야 합니다'),
  role: z.enum(['doctor', 'coordinator', 'nurse', 'admin']),
});

export const updateStaffSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['doctor', 'coordinator', 'nurse', 'admin']).optional(),
  is_active: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  new_password: z.string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(100, '비밀번호는 100자 이하이어야 합니다'),
});

// ========== Schedule API Schemas ==========

export const getSchedulePatternsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
  search: z.string().optional(),
});

export const updateSchedulePatternSchema = z.object({
  schedule_days: z.array(z.number().min(0).max(6)),
});

export const getDailyScheduleQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  source: z.enum(['all', 'auto', 'manual']).default('all'),
  status: z.enum(['all', 'active', 'cancelled']).default('all'),
});

export const addManualScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  patient_id: z.string().uuid('올바른 환자를 선택해주세요'),
});

export const cancelScheduleSchema = z.object({
  is_cancelled: z.boolean(),
});

// ========== Stats API Schemas ==========

export const getStatsSummaryQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getDailyStatsQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ========== Type Exports ==========

export type GetPatientsQuery = z.infer<typeof getPatientsQuerySchema>;
export type CreatePatientRequest = z.infer<typeof createPatientSchema>;
export type UpdatePatientRequest = z.infer<typeof updatePatientSchema>;

export type GetStaffQuery = z.infer<typeof getStaffQuerySchema>;
export type CreateStaffRequest = z.infer<typeof createStaffSchema>;
export type UpdateStaffRequest = z.infer<typeof updateStaffSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

export type GetSchedulePatternsQuery = z.infer<typeof getSchedulePatternsQuerySchema>;
export type UpdateSchedulePatternRequest = z.infer<typeof updateSchedulePatternSchema>;
export type GetDailyScheduleQuery = z.infer<typeof getDailyScheduleQuerySchema>;
export type AddManualScheduleRequest = z.infer<typeof addManualScheduleSchema>;
export type CancelScheduleRequest = z.infer<typeof cancelScheduleSchema>;

export type GetStatsSummaryQuery = z.infer<typeof getStatsSummaryQuerySchema>;
export type GetDailyStatsQuery = z.infer<typeof getDailyStatsQuerySchema>;

// ========== Response Types ==========

export interface PatientWithCoordinator {
  id: string;
  name: string;
  gender: 'M' | 'F' | null;
  room_number: string | null;
  patient_id_no: string | null;
  coordinator_id: string | null;
  coordinator_name: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  status: 'active' | 'discharged' | 'suspended';
  memo: string | null;
  created_at: string;
  updated_at: string;
  schedule_pattern: string; // "월,수,금" 형태
}

export interface PatientDetail extends PatientWithCoordinator {
  schedule_patterns: Array<{
    id: string;
    day_of_week: number;
    is_active: boolean;
  }>;
}

export interface StaffPublic {
  id: string;
  login_id: string;
  name: string;
  role: 'doctor' | 'coordinator' | 'nurse' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchedulePatternItem {
  patient_id: string;
  patient_name: string;
  coordinator_name: string | null;
  schedule_days: number[];
}

export interface DailyScheduleItem {
  id: string;
  patient_id: string;
  patient_name: string;
  coordinator_name: string | null;
  source: 'auto' | 'manual';
  is_cancelled: boolean;
  created_at: string;
}

export interface DailyScheduleStats {
  total: number;
  auto: number;
  manual: number;
  cancelled: number;
}

export interface DailyScheduleResponse {
  date: string;
  stats: DailyScheduleStats;
  data: DailyScheduleItem[];
}

export interface StatsSummary {
  period: {
    start: string;
    end: string;
  };
  average_attendance_rate: number;
  average_consultation_rate: number;
  total_scheduled: number;
  total_attendance: number;
  total_consultation: number;
  today: {
    scheduled: number;
    attendance: number;
    consultation: number;
  };
  previous_period: {
    average_attendance_rate: number;
    average_consultation_rate: number;
  };
}

export interface DailyStatsItem {
  id: string;
  date: string;
  scheduled_count: number;
  attendance_count: number;
  consultation_count: number;
  attendance_rate: number | null;
  consultation_rate: number | null;
  calculated_at: string;
}

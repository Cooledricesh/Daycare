import { z } from 'zod';

/**
 * 환자 검색 쿼리 파라미터 스키마
 */
export const searchQuerySchema = z.object({
  q: z.string().min(1, '검색어를 입력해주세요'),
});

/**
 * 출석 기록 생성 요청 스키마
 */
export const createAttendanceSchema = z.object({
  patient_id: z.string().uuid('유효하지 않은 환자 ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '유효하지 않은 날짜 형식 (YYYY-MM-DD)'),
});

/**
 * 출석 여부 확인 쿼리 파라미터 스키마
 */
export const checkAttendanceSchema = z.object({
  patient_id: z.string().uuid('유효하지 않은 환자 ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '유효하지 않은 날짜 형식 (YYYY-MM-DD)'),
});

/**
 * 활력징후 기록 생성 요청 스키마
 */
export const createVitalsSchema = z.object({
  patient_id: z.string().uuid('유효하지 않은 환자 ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '유효하지 않은 날짜 형식 (YYYY-MM-DD)'),
  systolic: z.number().int().min(50).max(250).nullable().optional(),
  diastolic: z.number().int().min(30).max(150).nullable().optional(),
  blood_sugar: z.number().int().min(30).max(600).nullable().optional(),
  memo: z.string().max(500).nullable().optional(),
});

// Type exports
export type SearchQueryParams = z.infer<typeof searchQuerySchema>;
export type CreateAttendanceRequest = z.infer<typeof createAttendanceSchema>;
export type CheckAttendanceParams = z.infer<typeof checkAttendanceSchema>;
export type CreateVitalsRequest = z.infer<typeof createVitalsSchema>;

/**
 * 응답 타입
 */
export interface Patient {
  id: string;
  name: string;
}

export interface Attendance {
  id: string;
  patient_id: string;
  date: string;
  checked_at: string;
}

export interface Vitals {
  id: string;
  patient_id: string;
  date: string;
  systolic: number | null;
  diastolic: number | null;
  blood_sugar: number | null;
  memo: string | null;
  recorded_at: string;
}

export interface CheckAttendanceResult {
  is_attended: boolean;
}

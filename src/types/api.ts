/**
 * 공통 API 응답 타입
 */

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  statusCode: number;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  statusCode: number;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Task 관련 공통 타입
 */
export interface TaskCompletionBase {
  id: string;
  consultation_id: string;
  is_completed: boolean;
  completed_at: string | null;
  memo: string | null;
}

export interface CompleteTaskParams {
  consultation_id: string;
  memo?: string;
}

/**
 * Message 관련 공통 타입
 */
export interface MessageBase {
  id: string;
  patient_id: string;
  date: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface CreateMessageParams {
  patient_id: string;
  date: string;
  content: string;
}

/**
 * 날짜 유틸리티 타입
 */
export type DateString = string; // YYYY-MM-DD format

/**
 * 사용자 역할 타입
 */
export type UserRole = 'admin' | 'doctor' | 'coordinator' | 'nurse';
export type TaskRole = 'coordinator' | 'nurse';
export type MessageAuthorRole = 'coordinator' | 'nurse';

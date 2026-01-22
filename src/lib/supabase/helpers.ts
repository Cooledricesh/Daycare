import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * 타입 안전한 Supabase 클라이언트 타입
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * 테이블별 Row 타입 헬퍼
 */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

/**
 * 자주 사용되는 테이블 타입 별칭
 */
export type StaffRow = TableRow<'staff'>;
export type PatientRow = TableRow<'patients'>;
export type AttendanceRow = TableRow<'attendances'>;
export type VitalsRow = TableRow<'vitals'>;
export type ConsultationRow = TableRow<'consultations'>;
export type TaskCompletionRow = TableRow<'task_completions'>;
export type MessageRow = TableRow<'messages'>;
export type ScheduledPatternRow = TableRow<'scheduled_patterns'>;
export type ScheduledAttendanceRow = TableRow<'scheduled_attendances'>;
export type DailyStatsRow = TableRow<'daily_stats'>;

/**
 * 관계 조인 결과 타입
 */
export interface PatientWithCoordinator extends PatientRow {
  coordinator: Pick<StaffRow, 'id' | 'name'> | null;
  doctor: Pick<StaffRow, 'id' | 'name'> | null;
}

export interface ConsultationWithDoctor extends ConsultationRow {
  staff: Pick<StaffRow, 'name'> | null;
}

export interface ConsultationWithTaskCompletions extends ConsultationRow {
  task_completions: TaskCompletionRow[];
}

/**
 * 쿼리 결과 타입 가드
 */
export function isQuerySuccess<T>(
  result: { data: T | null; error: unknown }
): result is { data: T; error: null } {
  return result.error === null && result.data !== null;
}

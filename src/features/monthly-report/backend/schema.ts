import { z } from 'zod';
import { ACTION_ITEMS_MAX_LENGTH } from '../constants/thresholds';

// ========== JSONB 구조 스키마 ==========

export const WeeklyTrendEntrySchema = z.object({
  week_number: z.number().int().min(1).max(6),
  start_date: z.string(),
  end_date: z.string(),
  total_attendance: z.number().int().min(0),
  working_days: z.number().int().min(0),
});

export const WeekdayAvgSchema = z.object({
  mon: z.number().min(0),
  tue: z.number().min(0),
  wed: z.number().min(0),
  thu: z.number().min(0),
  fri: z.number().min(0),
});

export const PrevMonthComparisonSchema = z.object({
  total_attendance_days_delta: z.number(),
  total_attendance_days_delta_pct: z.number(),
  per_patient_avg_days_delta: z.number(),
  daily_avg_attendance_delta: z.number(),
  consultation_rate_delta: z.number(),
  registered_count_delta: z.number(),
});

export const CoordinatorPerformanceEntrySchema = z.object({
  coordinator_id: z.string(),
  coordinator_name: z.string(),
  assigned_patient_count: z.number().int().min(0),
  avg_attendance_rate: z.number().min(0).max(100),
  consultation_attendance_rate: z.number().min(0).max(100),
  consecutive_absence_patient_count: z.number().int().min(0),
});

export const TopAttenderEntrySchema = z.object({
  patient_id: z.string(),
  name: z.string(),
  attendance_days: z.number().int().min(0),
  attendance_rate: z.number().min(0).max(100),
});

export const RiskPatientEntrySchema = z.object({
  patient_id: z.string(),
  name: z.string(),
  attendance_days: z.number().int().min(0),
  attendance_rate: z.number().min(0).max(100),
  longest_consecutive_absence: z.number().int().min(0),
});

export const NewPatientEntrySchema = z.object({
  patient_id: z.string(),
  name: z.string(),
  registered_date: z.string(),
  attendance_days: z.number().int().min(0),
  possible_days: z.number().int().min(0),
});

export const DischargeEntrySchema = z.object({
  patient_id: z.string().nullable(),
  patient_id_no: z.string(),
  name: z.string(),
  discharge_date: z.string(),
  type: z.enum(['ward_admission', 'activity_stop']),
});

export const PatientSegmentsSchema = z.object({
  top_attenders: z.array(TopAttenderEntrySchema),
  risk_patients: z.array(RiskPatientEntrySchema),
  new_patients: z.array(NewPatientEntrySchema),
  discharges: z.array(DischargeEntrySchema),
});

export const ConsultationStatsSchema = z.object({
  scheduled_count: z.number().int().min(0),
  performed_count: z.number().int().min(0),
  missed_count: z.number().int().min(0),
  missed_by_reason: z.object({
    absent: z.number().int().min(0),
    other: z.number().int().min(0),
  }),
});

export const SpecialNoteEntrySchema = z.object({
  type: z.enum(['holiday', 'outlier', 'data_gap']),
  date: z.string(),
  description: z.string(),
});

// ========== 요청 파라미터 스키마 ==========

export const MonthlyReportParamsSchema = z.object({
  year: z.coerce.number().int().min(2026).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const ActionItemsUpdateSchema = z.object({
  action_items: z.string().max(ACTION_ITEMS_MAX_LENGTH),
});

// ========== 응답 스키마 ==========

export const MonthlyReportResponseSchema = z.object({
  id: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int(),
  total_attendance_days: z.number().int(),
  per_patient_avg_days: z.number(),
  daily_avg_attendance: z.number(),
  consultation_attendance_rate: z.number(),
  registered_count_eom: z.number().int(),
  new_patient_count: z.number().int(),
  discharged_count: z.number().int(),
  weekly_trend: z.array(WeeklyTrendEntrySchema),
  weekday_avg: WeekdayAvgSchema,
  prev_month_comparison: PrevMonthComparisonSchema,
  coordinator_performance: z.array(CoordinatorPerformanceEntrySchema),
  patient_segments: PatientSegmentsSchema,
  consultation_stats: ConsultationStatsSchema,
  special_notes: z.array(SpecialNoteEntrySchema),
  action_items: z.string(),
  generated_at: z.string(),
  generated_by: z.enum(['cron', 'manual']),
  created_at: z.string(),
  updated_at: z.string(),
});

export const MonthlyReportListItemSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  generated_at: z.string(),
});

// ========== TypeScript 타입 ==========

export type WeeklyTrendEntry = z.infer<typeof WeeklyTrendEntrySchema>;
export type WeekdayAvg = z.infer<typeof WeekdayAvgSchema>;
export type PrevMonthComparison = z.infer<typeof PrevMonthComparisonSchema>;
export type CoordinatorPerformanceEntry = z.infer<typeof CoordinatorPerformanceEntrySchema>;
export type TopAttenderEntry = z.infer<typeof TopAttenderEntrySchema>;
export type RiskPatientEntry = z.infer<typeof RiskPatientEntrySchema>;
export type NewPatientEntry = z.infer<typeof NewPatientEntrySchema>;
export type DischargeEntry = z.infer<typeof DischargeEntrySchema>;
export type PatientSegments = z.infer<typeof PatientSegmentsSchema>;
export type ConsultationStats = z.infer<typeof ConsultationStatsSchema>;
export type SpecialNoteEntry = z.infer<typeof SpecialNoteEntrySchema>;
export type MonthlyReportResponse = z.infer<typeof MonthlyReportResponseSchema>;
export type MonthlyReportListItem = z.infer<typeof MonthlyReportListItemSchema>;
export type MonthlyReportParams = z.infer<typeof MonthlyReportParamsSchema>;
export type ActionItemsUpdate = z.infer<typeof ActionItemsUpdateSchema>;

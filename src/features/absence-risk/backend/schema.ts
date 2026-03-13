import { z } from 'zod';
import type { RiskLevel, Trend, AbsencePeriod } from '../constants/risk-thresholds';

export const getAbsenceOverviewQuerySchema = z.object({
  period: z.enum(['14d', '30d', '60d', '90d']).default('30d'),
  coordinator_id: z.string().uuid().optional(),
});

export const getAbsenceDetailQuerySchema = z.object({
  period: z.enum(['14d', '30d', '60d', '90d']).default('30d'),
});

export type GetAbsenceOverviewQuery = z.infer<typeof getAbsenceOverviewQuerySchema>;
export type GetAbsenceDetailQuery = z.infer<typeof getAbsenceDetailQuerySchema>;

export type AbsenceOverviewItem = {
  patient_id: string;
  name: string;
  display_name: string | null;
  room_number: string | null;
  coordinator_name: string | null;
  consecutive_absences: number;
  attendance_rate: number;
  total_scheduled: number;
  total_attended: number;
  total_absent: number;
  risk_level: RiskLevel;
  trend: Trend;
  last_attended_date: string | null;
  recent_rate: number;
  previous_rate: number;
};

export type AbsenceDailyRecord = {
  date: string;
  scheduled: boolean;
  attended: boolean;
  is_holiday: boolean;
  is_weekend: boolean;
  holiday_reason?: string;
};

export type AbsenceSummary = {
  consecutive_absences: number;
  attendance_rate: number;
  total_scheduled: number;
  total_attended: number;
  total_absent: number;
  risk_level: RiskLevel;
  trend: Trend;
  last_attended_date: string | null;
  recent_rate: number;
  previous_rate: number;
  schedule_pattern: string;
};

export type PatientAbsenceDetail = {
  patient: {
    id: string;
    name: string;
    display_name: string | null;
    room_number: string | null;
    coordinator_name: string | null;
  };
  summary: AbsenceSummary;
  daily_records: AbsenceDailyRecord[];
  period: AbsencePeriod;
};

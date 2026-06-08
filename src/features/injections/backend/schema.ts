import { z } from 'zod';

export const PatientInjectionSchema = z.object({
  item_name: z.string(),
  interval_weeks: z.number().int().positive(),
  last_executed_date: z.string().nullable(),
  next_due_date: z.string(),
});

export const PatientInjectionsResponseSchema = z.object({
  patient_id: z.string().uuid(),
  patient_id_no: z.string(),
  patient_name: z.string().nullable(),
  injections: z.array(PatientInjectionSchema),
  upstream_available: z.boolean(),
});

export type PatientInjection = z.infer<typeof PatientInjectionSchema>;
export type PatientInjectionsResponse = z.infer<typeof PatientInjectionsResponseSchema>;

export const UpcomingInjectionItemSchema = z.object({
  patient_id: z.string().uuid().nullable(),
  patient_id_no: z.string(),
  patient_name: z.string(),
  item_name: z.string(),
  interval_weeks: z.number().int().positive(),
  last_executed_date: z.string().nullable(),
  next_due_date: z.string(),
});

export const UpcomingInjectionsResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  count: z.number().int().nonnegative(),
  items: z.array(UpcomingInjectionItemSchema),
  upstream_available: z.boolean(),
});

export type UpcomingInjectionItem = z.infer<typeof UpcomingInjectionItemSchema>;
export type UpcomingInjectionsResponse = z.infer<typeof UpcomingInjectionsResponseSchema>;

export const InjectionHistoryEntrySchema = z.object({
  dose_seq: z.number().int().positive(),
  executed_date: z.string(),
  planned_date: z.string().nullable(),
});

export const InjectionHistoryItemSchema = z.object({
  item_name: z.string(),
  interval_weeks: z.number().int().positive(),
  next_due_date: z.string().nullable(),
  total_doses: z.number().int().nonnegative(),
  history: z.array(InjectionHistoryEntrySchema),
});

export const PatientInjectionHistoryResponseSchema = z.object({
  patient_id: z.string().uuid(),
  patient_id_no: z.string(),
  patient_name: z.string().nullable(),
  injections: z.array(InjectionHistoryItemSchema),
  upstream_available: z.boolean(),
});

export type InjectionHistoryItem = z.infer<typeof InjectionHistoryItemSchema>;
export type PatientInjectionHistoryResponse = z.infer<typeof PatientInjectionHistoryResponseSchema>;

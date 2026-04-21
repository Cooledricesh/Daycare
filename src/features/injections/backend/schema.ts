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

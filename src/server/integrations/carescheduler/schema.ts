import { z } from 'zod';

export const CareschedulerInjectionSchema = z.object({
  item_name: z.string(),
  interval_weeks: z.number().int().positive(),
  last_executed_date: z.string().nullable(),
  next_due_date: z.string(),
});

export const CareschedulerInjectionsResponseSchema = z.object({
  patient_number: z.string(),
  patient_name: z.string().nullable(),
  injections: z.array(CareschedulerInjectionSchema),
});

export type CareschedulerInjection = z.infer<typeof CareschedulerInjectionSchema>;
export type CareschedulerInjectionsResponse = z.infer<
  typeof CareschedulerInjectionsResponseSchema
>;

import { z } from 'zod';

export const TimelineEventTypeSchema = z.enum([
  'attendance',
  'consultation',
  'message',
  'absence',
  'admission',
  'discharge',
  'birthday',
]);

export const TimelineEventSchema = z.object({
  date: z.string(),
  type: TimelineEventTypeSchema,
  label: z.string(),
});

export const PatientTimelineResponseSchema = z.object({
  patientId: z.string(),
  range: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  events: z.array(TimelineEventSchema),
});

export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type PatientTimelineResponse = z.infer<typeof PatientTimelineResponseSchema>;

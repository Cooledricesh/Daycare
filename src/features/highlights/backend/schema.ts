import { z } from 'zod';

export const HighlightPatientSchema = z.object({
  id: z.string(),
  name: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  room_number: z.string().nullable(),
  meta: z.string().optional(),
});

export const TodayHighlightsResponseSchema = z.object({
  date: z.string(),
  events: z.object({
    threeDayAbsence: z.array(HighlightPatientSchema),
    suddenAbsence: z.array(HighlightPatientSchema),
    examMissed: z.array(HighlightPatientSchema),
    birthdays: z.array(HighlightPatientSchema),
    newlyRegistered: z.array(HighlightPatientSchema),
  }),
});

export type HighlightPatient = z.infer<typeof HighlightPatientSchema>;
export type TodayHighlightsResponse = z.infer<typeof TodayHighlightsResponseSchema>;

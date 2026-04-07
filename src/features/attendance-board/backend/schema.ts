import { z } from 'zod';

export const getAttendanceBoardSchema = z.object({
  date: z.string().optional(),
});

export type GetAttendanceBoardParams = z.infer<typeof getAttendanceBoardSchema>;

/** 스트릭 등급 */
export type StreakTier = 'none' | 'fire' | 'lightning' | 'diamond' | 'crown' | 'myth';

export type BoardPatient = {
  id: string;
  name: string;
  display_name: string | null;
  gender: 'M' | 'F' | null;
  room_number: string | null;
  is_attended: boolean;
  attendance_time: string | null;
  is_scheduled: boolean;
  is_consulted: boolean;
  has_task: boolean;
  task_completed: boolean;
  attendance_streak: number;
  consultation_streak: number;
  streak_tier: StreakTier;
};

export type RoomGroup = {
  room_prefix: string;
  coordinator_name: string | null;
  patients: BoardPatient[];
  attended_count: number;
  total_count: number;
};

export type AttendanceBoardResponse = {
  date: string;
  rooms: RoomGroup[];
  total_attended: number;
  total_count: number;
};

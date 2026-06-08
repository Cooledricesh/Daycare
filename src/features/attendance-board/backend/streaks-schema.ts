import type { PatientStreaks } from '@/features/shared/backend/streak';

export type StreaksResponse = {
  date: string;
  streaks: Record<string, PatientStreaks>;
};

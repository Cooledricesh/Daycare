export const streakKeys = {
  all: ['streaks'] as const,
  byDate: (date: string) => ['streaks', date] as const,
};

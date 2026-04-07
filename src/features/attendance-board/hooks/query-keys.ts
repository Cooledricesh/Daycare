export const attendanceBoardKeys = {
  all: ['attendance-board'] as const,
  board: {
    all: ['attendance-board', 'board'] as const,
    byDate: (date: string) => ['attendance-board', 'board', date] as const,
  },
} as const;

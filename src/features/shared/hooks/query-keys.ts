export const sharedKeys = {
  statsSummary: {
    all: ['shared', 'stats-summary'] as const,
    detail: (query: object) => ['shared', 'stats-summary', query] as const,
  },
  dailyStats: {
    all: ['shared', 'daily-stats'] as const,
    list: (query: object) => ['shared', 'daily-stats', query] as const,
  },
  dayOfWeekStats: {
    all: ['shared', 'day-of-week-stats'] as const,
  },
  attendanceCalendar: {
    all: ['shared', 'attendance-calendar'] as const,
    detail: (patientId: string, year: number, month: number) => ['shared', 'attendance-calendar', patientId, year, month] as const,
  },
  absenceRiskOverview: {
    all: ['shared', 'absence-risk-overview'] as const,
    detail: (period: string) => ['shared', 'absence-risk-overview', period] as const,
  },
  absenceRiskDetail: {
    all: ['shared', 'absence-risk-detail'] as const,
    detail: (patientId: string, period: string) => ['shared', 'absence-risk-detail', patientId, period] as const,
  },
  messages: {
    all: ['shared', 'messages'] as const,
    list: (params: object) => ['shared', 'messages', params] as const,
  },
  tasks: {
    all: ['shared', 'tasks'] as const,
    list: (params: object) => ['shared', 'tasks', params] as const,
  },
  vitalsOverview: {
    all: ['shared', 'vitals-overview'] as const,
  },
  patientVitals: {
    all: ['shared', 'patient-vitals'] as const,
    detail: (patientId: string, period: string) => ['shared', 'patient-vitals', patientId, period] as const,
  },
} as const;

export const adminKeys = {
  all: ['admin'] as const,
  patients: {
    all: ['admin', 'patients'] as const,
    list: (filters?: object) => ['admin', 'patients', filters] as const,
    detail: (id: string) => ['admin', 'patients', id] as const,
  },
  coordinators: {
    all: ['admin', 'coordinators'] as const,
  },
  doctors: {
    all: ['admin', 'doctors'] as const,
  },
  staff: {
    all: ['admin', 'staff'] as const,
    list: (filters?: object) => ['admin', 'staff', filters] as const,
    detail: (id: string) => ['admin', 'staff', id] as const,
  },
  schedulePatterns: {
    all: ['admin', 'schedule-patterns'] as const,
    list: (filters?: object) => ['admin', 'schedule-patterns', filters] as const,
  },
  dailySchedule: {
    all: ['admin', 'daily-schedule'] as const,
    list: (filters?: object) => ['admin', 'daily-schedule', filters] as const,
  },
  statsSummary: {
    all: ['admin', 'stats-summary'] as const,
    detail: (filters?: object) => ['admin', 'stats-summary', filters] as const,
  },
  dailyStats: {
    all: ['admin', 'daily-stats'] as const,
    list: (filters?: object) => ['admin', 'daily-stats', filters] as const,
  },
  roomMapping: {
    all: ['admin', 'room-mapping'] as const,
  },
  syncLogs: {
    all: ['admin', 'sync-logs'] as const,
    list: (filters?: object) => ['admin', 'sync-logs', filters] as const,
    detail: (id: string) => ['admin', 'sync-logs', id] as const,
  },
  holidays: {
    all: ['admin', 'holidays'] as const,
    list: (filters?: object) => ['admin', 'holidays', filters] as const,
  },
  dashboard: {
    all: ['admin', 'dashboard'] as const,
    patients: (date: string) => ['admin', 'dashboard', 'patients', date] as const,
    patient: (patientId: string, date: string) => ['admin', 'dashboard', 'patient', patientId, date] as const,
    patientAll: ['admin', 'dashboard', 'patient'] as const,
    patientHistory: (patientId: string, months: number) => ['admin', 'dashboard', 'patient-history', patientId, months] as const,
    patientHistoryAll: ['admin', 'dashboard', 'patient-history'] as const,
    patientsAll: ['admin', 'dashboard', 'patients'] as const,
  },
  coordinatorWorkload: {
    all: ['admin', 'coordinator-workload'] as const,
    detail: (filters?: object) => ['admin', 'coordinator-workload', filters] as const,
  },
} as const;

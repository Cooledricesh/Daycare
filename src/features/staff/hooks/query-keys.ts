export const staffKeys = {
  all: ['staff'] as const,
  myPatients: {
    all: ['staff', 'my-patients'] as const,
    list: (date: string, showAll: string) => ['staff', 'my-patients', date, showAll] as const,
  },
  patient: {
    all: ['staff', 'patient'] as const,
    detail: (patientId: string, date: string) => ['staff', 'patient', patientId, date] as const,
  },
  patientHistory: {
    all: ['staff', 'patient-history'] as const,
    detail: (patientId: string, months: number) => ['staff', 'patient-history', patientId, months] as const,
  },
  messages: {
    all: ['staff', 'messages'] as const,
    list: (params: object) => ['staff', 'messages', params] as const,
  },
  schedulePatterns: {
    all: ['staff', 'schedule-patterns'] as const,
  },
} as const;

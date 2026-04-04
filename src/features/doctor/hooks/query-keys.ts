export const doctorKeys = {
  all: ['doctor'] as const,
  waitingPatients: {
    all: ['doctor', 'waiting-patients'] as const,
    list: (params: object) => ['doctor', 'waiting-patients', params] as const,
  },
  patientHistory: {
    all: ['doctor', 'patient-history'] as const,
    detail: (patientId: string, months: number) => ['doctor', 'patient-history', patientId, months] as const,
  },
  patientMessages: {
    all: ['doctor', 'patient-messages'] as const,
    detail: (patientId: string, date: string) => ['doctor', 'patient-messages', patientId, date] as const,
  },
} as const;

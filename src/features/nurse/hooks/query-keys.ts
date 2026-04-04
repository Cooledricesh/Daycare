export const nurseKeys = {
  all: ['nurse'] as const,
  patients: {
    all: ['nurse', 'patients'] as const,
    list: (date: string, filter: string) => ['nurse', 'patients', date, filter] as const,
  },
  patient: {
    all: ['nurse', 'patient'] as const,
    detail: (patientId: string, date: string) => ['nurse', 'patient', patientId, date] as const,
  },
  patientHistory: {
    all: ['nurse', 'patient-history'] as const,
    detail: (patientId: string, months: number) => ['nurse', 'patient-history', patientId, months] as const,
  },
  prescriptions: {
    all: ['nurse', 'prescriptions'] as const,
    list: (date: string, filter: string) => ['nurse', 'prescriptions', date, filter] as const,
  },
} as const;

export const injectionsKeys = {
  all: ['injections'] as const,
  patient: {
    all: ['injections', 'patient'] as const,
    detail: (patientId: string) => ['injections', 'patient', patientId] as const,
  },
  upcoming: {
    all: ['injections', 'upcoming'] as const,
    list: (days: number) => ['injections', 'upcoming', days] as const,
  },
} as const;

export const injectionsKeys = {
  all: ['injections'] as const,
  patient: {
    all: ['injections', 'patient'] as const,
    detail: (patientId: string) => ['injections', 'patient', patientId] as const,
  },
} as const;

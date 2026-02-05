export const DoctorErrorCode = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',
  CONSULTATION_NOT_FOUND: 'CONSULTATION_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
} as const;

export type DoctorErrorCodeType = typeof DoctorErrorCode[keyof typeof DoctorErrorCode];

export class DoctorError extends Error {
  constructor(
    public code: DoctorErrorCodeType,
    message: string,
  ) {
    super(message);
    this.name = 'DoctorError';
  }
}

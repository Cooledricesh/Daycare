/**
 * 환자 기능 관련 에러 코드
 */
export const PatientErrorCode = {
  PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',
  ALREADY_ATTENDED: 'ALREADY_ATTENDED',
  INVALID_SEARCH_QUERY: 'INVALID_SEARCH_QUERY',
  INVALID_PATIENT_ID: 'INVALID_PATIENT_ID',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  VITALS_SAVE_FAILED: 'VITALS_SAVE_FAILED',
  ATTENDANCE_SAVE_FAILED: 'ATTENDANCE_SAVE_FAILED',
} as const;

export type PatientErrorCode = (typeof PatientErrorCode)[keyof typeof PatientErrorCode];

export class PatientError extends Error {
  constructor(
    public code: PatientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PatientError';
  }
}

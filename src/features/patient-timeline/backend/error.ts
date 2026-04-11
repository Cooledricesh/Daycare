export enum PatientTimelineErrorCode {
  FETCH_FAILED = 'PATIENT_TIMELINE_FETCH_FAILED',
  PATIENT_NOT_FOUND = 'PATIENT_TIMELINE_PATIENT_NOT_FOUND',
}

export class PatientTimelineError extends Error {
  constructor(
    public code: PatientTimelineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PatientTimelineError';
  }
}

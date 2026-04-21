export enum InjectionsErrorCode {
  PATIENT_NOT_FOUND = 'INJECTIONS_PATIENT_NOT_FOUND',
  MISSING_PATIENT_ID_NO = 'INJECTIONS_MISSING_PATIENT_ID_NO',
  UPSTREAM_UNAVAILABLE = 'INJECTIONS_UPSTREAM_UNAVAILABLE',
  INVALID_REQUEST = 'INJECTIONS_INVALID_REQUEST',
}

export class InjectionsError extends Error {
  constructor(
    public code: InjectionsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'InjectionsError';
  }
}

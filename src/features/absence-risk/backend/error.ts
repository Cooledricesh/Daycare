export enum AbsenceRiskErrorCode {
  PATIENT_NOT_FOUND = 'PATIENT_NOT_FOUND',
  INVALID_PERIOD = 'INVALID_PERIOD',
  FETCH_FAILED = 'FETCH_FAILED',
}

export class AbsenceRiskError extends Error {
  constructor(
    public readonly code: AbsenceRiskErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AbsenceRiskError';
  }
}

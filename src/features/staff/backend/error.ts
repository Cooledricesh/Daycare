export enum StaffErrorCode {
  UNAUTHORIZED = 'STAFF_UNAUTHORIZED',
  PATIENT_NOT_FOUND = 'STAFF_PATIENT_NOT_FOUND',
  TASK_NOT_FOUND = 'STAFF_TASK_NOT_FOUND',
  TASK_ALREADY_COMPLETED = 'STAFF_TASK_ALREADY_COMPLETED',
  MESSAGE_SAVE_FAILED = 'STAFF_MESSAGE_SAVE_FAILED',
  MESSAGE_DELETE_FAILED = 'STAFF_MESSAGE_DELETE_FAILED',
  INVALID_REQUEST = 'STAFF_INVALID_REQUEST',
}

export class StaffError extends Error {
  constructor(
    public code: StaffErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StaffError';
  }
}

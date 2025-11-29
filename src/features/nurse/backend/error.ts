export enum NurseErrorCode {
  TASK_NOT_FOUND = 'NURSE_TASK_NOT_FOUND',
  TASK_ALREADY_COMPLETED = 'NURSE_TASK_ALREADY_COMPLETED',
  MESSAGE_SAVE_FAILED = 'NURSE_MESSAGE_SAVE_FAILED',
  INVALID_REQUEST = 'NURSE_INVALID_REQUEST',
}

export class NurseError extends Error {
  constructor(
    public code: NurseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'NurseError';
  }
}

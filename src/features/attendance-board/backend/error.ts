export const AttendanceBoardErrorCode = {
  FETCH_FAILED: 'ATTENDANCE_BOARD_FETCH_FAILED',
} as const;

export type AttendanceBoardErrorCode = (typeof AttendanceBoardErrorCode)[keyof typeof AttendanceBoardErrorCode];

export class AttendanceBoardError extends Error {
  constructor(
    public readonly code: AttendanceBoardErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AttendanceBoardError';
  }
}

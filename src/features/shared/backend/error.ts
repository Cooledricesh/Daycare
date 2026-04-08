export const AVATAR_ERROR_CODES = {
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  DB_UPDATE_FAILED: 'DB_UPDATE_FAILED',
} as const;

export type AvatarErrorCode = (typeof AVATAR_ERROR_CODES)[keyof typeof AVATAR_ERROR_CODES];

export class AvatarError extends Error {
  constructor(
    public readonly code: AvatarErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AvatarError';
  }
}

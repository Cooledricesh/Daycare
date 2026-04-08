export const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AvatarAllowedMimeType = (typeof AVATAR_ALLOWED_MIME_TYPES)[number];

export const AVATAR_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const AVATAR_MAX_DIMENSION = 200; // px
export const AVATAR_QUALITY = 80;
export const AVATAR_BUCKET = 'patient-avatars';

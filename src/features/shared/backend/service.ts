import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import sharp from 'sharp';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE,
  AVATAR_MAX_DIMENSION,
  AVATAR_QUALITY,
  AVATAR_BUCKET,
  type AvatarAllowedMimeType,
} from '../constants/avatar';
import { AvatarError } from './error';

export type AvatarStorageConfig = {
  url: string;
  apiKey: string;
};

function isAllowedMimeType(type: string): type is AvatarAllowedMimeType {
  return (AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

function avatarObjectPath(patientId: string): string {
  return `${encodeURIComponent(patientId)}.webp`;
}

function avatarWriteUrl(storage: AvatarStorageConfig, patientId: string): string {
  return `${storage.url.replace(/\/$/u, '')}/storage/v1/object/${AVATAR_BUCKET}/${avatarObjectPath(patientId)}`;
}

function avatarPublicUrl(storage: AvatarStorageConfig, patientId: string): string {
  return `${storage.url.replace(/\/$/u, '')}/storage/v1/object/public/${AVATAR_BUCKET}/${avatarObjectPath(patientId)}`;
}

async function putAvatar(
  storage: AvatarStorageConfig,
  patientId: string,
  body: Buffer,
): Promise<void> {
  const response = await fetch(avatarWriteUrl(storage, patientId), {
    method: 'PUT',
    headers: {
      apikey: storage.apiKey,
      'Content-Type': 'image/webp',
      'User-Agent': 'daycare-vercel/1.0',
    },
    body: new Uint8Array(body),
  });
  if (!response.ok) {
    throw new AvatarError('UPLOAD_FAILED', `Storage 업로드 실패: HTTP ${response.status}`);
  }
}

async function removeAvatar(storage: AvatarStorageConfig, patientId: string): Promise<void> {
  const response = await fetch(avatarWriteUrl(storage, patientId), {
    method: 'DELETE',
    headers: {
      apikey: storage.apiKey,
      'User-Agent': 'daycare-vercel/1.0',
    },
  });
  if (!response.ok && response.status !== 404) {
    throw new AvatarError('UPLOAD_FAILED', `Storage 삭제 실패: HTTP ${response.status}`);
  }
}

export async function uploadPatientAvatar(
  supabase: SupabaseClient<Database>,
  storage: AvatarStorageConfig,
  patientId: string,
  file: File,
): Promise<{ avatarUrl: string }> {
  if (!isAllowedMimeType(file.type)) {
    throw new AvatarError('INVALID_FILE_TYPE', '지원하지 않는 파일 형식입니다. (jpg, png, webp만 가능)');
  }

  if (file.size > AVATAR_MAX_FILE_SIZE) {
    throw new AvatarError('FILE_TOO_LARGE', '파일 크기가 2MB를 초과합니다.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const resizedBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(AVATAR_MAX_DIMENSION, AVATAR_MAX_DIMENSION, { fit: 'cover' })
    .webp({ quality: AVATAR_QUALITY })
    .toBuffer();

  await putAvatar(storage, patientId, resizedBuffer);
  const avatarUrl = avatarPublicUrl(storage, patientId);

  const { error: dbError } = await supabase
    .from('patients')
    .update({ avatar_url: avatarUrl })
    .eq('id', patientId);

  if (dbError) {
    await removeAvatar(storage, patientId).catch(() => undefined);
    throw new AvatarError('DB_UPDATE_FAILED', `DB 업데이트 실패: ${dbError.message}`);
  }

  return { avatarUrl };
}

export async function deletePatientAvatar(
  supabase: SupabaseClient<Database>,
  storage: AvatarStorageConfig,
  patientId: string,
): Promise<void> {
  await removeAvatar(storage, patientId);

  const { error: dbError } = await supabase
    .from('patients')
    .update({ avatar_url: null })
    .eq('id', patientId);

  if (dbError) {
    throw new AvatarError('DB_UPDATE_FAILED', `DB 업데이트 실패: ${dbError.message}`);
  }
}

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

function isAllowedMimeType(type: string): type is AvatarAllowedMimeType {
  return (AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

export async function uploadPatientAvatar(
  supabase: SupabaseClient<Database>,
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

  const filePath = `${patientId}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, resizedBuffer, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (uploadError) {
    throw new AvatarError('UPLOAD_FAILED', `Storage 업로드 실패: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(filePath);

  const avatarUrl = urlData.publicUrl;

  const { error: dbError } = await supabase
    .from('patients')
    .update({ avatar_url: avatarUrl })
    .eq('id', patientId);

  if (dbError) {
    throw new AvatarError('DB_UPDATE_FAILED', `DB 업데이트 실패: ${dbError.message}`);
  }

  return { avatarUrl };
}

export async function deletePatientAvatar(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<void> {
  const filePath = `${patientId}.webp`;

  // Storage 삭제 시도 — 파일이 없어도 에러 무시
  await supabase.storage.from(AVATAR_BUCKET).remove([filePath]);

  const { error: dbError } = await supabase
    .from('patients')
    .update({ avatar_url: null })
    .eq('id', patientId);

  if (dbError) {
    throw new AvatarError('DB_UPDATE_FAILED', `DB 업데이트 실패: ${dbError.message}`);
  }
}


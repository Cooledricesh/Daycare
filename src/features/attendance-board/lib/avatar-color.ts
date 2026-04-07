import { PIXEL_AVATAR_COLORS } from '../constants/pixel-palette';

/**
 * 환자 ID를 해시하여 레트로 팔레트에서 고유 색상 반환
 */
export function getAvatarColor(patientId: string): string {
  let hash = 0;
  for (let i = 0; i < patientId.length; i++) {
    const char = patientId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const index = Math.abs(hash) % PIXEL_AVATAR_COLORS.length;
  return PIXEL_AVATAR_COLORS[index];
}

/**
 * 환자 이름에서 이니셜 추출 (한글 첫 글자 또는 영문 첫 글자)
 */
export function getInitial(name: string): string {
  return name.charAt(0);
}

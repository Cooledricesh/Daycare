/**
 * 슬랙 알림 채널 정의 (대동병원 워크스페이스, 봇: @alimi)
 *
 * 새 채널에 보내려면: 슬랙에서 해당 채널에 `/invite @alimi` 후 여기에 상수 추가.
 * 환경변수 추가는 불필요 (SLACK_BOT_TOKEN 하나로 모든 채널 전송).
 */
export const SLACK_CHANNELS = {
  /** 정오 출석 현황 + 월간 리포트 요약 */
  CONSULTATION: '#진찰',
  /** 회원 생일 알림 (마루 = 대동병원 낮병원 이름) */
  MARU: '#마루',
} as const;

export type SlackChannel = (typeof SLACK_CHANNELS)[keyof typeof SLACK_CHANNELS];

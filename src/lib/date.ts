/**
 * 날짜 관련 유틸리티 함수
 */

/**
 * 한국어 요일명 배열
 */
export const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

export type DayNameKo = (typeof DAY_NAMES_KO)[number];

/**
 * 요일 인덱스(0-6)를 한국어 요일명으로 변환
 */
export function getDayNameKo(dayIndex: number): DayNameKo {
  if (dayIndex < 0 || dayIndex > 6) {
    throw new Error(`Invalid day index: ${dayIndex}. Must be 0-6.`);
  }
  return DAY_NAMES_KO[dayIndex];
}

/**
 * 요일 배열을 한국어 문자열로 변환
 * @example [1, 3, 5] -> "월,수,금"
 */
export function formatScheduleDays(days: number[]): string {
  return days
    .sort((a, b) => a - b)
    .map((day) => getDayNameKo(day))
    .join(',');
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (한국 시간 기준)
 */
export function getTodayString(): string {
  const now = new Date();
  // UTC+9 (한국 시간)
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

/**
 * 날짜 문자열이 유효한 YYYY-MM-DD 형식인지 검증
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * 어제 날짜를 YYYY-MM-DD 형식으로 반환 (한국 시간 기준)
 */
export function getYesterdayString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setDate(kst.getDate() - 1);
  return kst.toISOString().split('T')[0];
}

/**
 * 현재 시각의 한국 시간 Date 객체 반환 (UTC+9 보정)
 */
export function getNowKST(): Date {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

/**
 * N개월 전 날짜를 YYYY-MM-DD 형식으로 반환 (한국 시간 기준)
 */
export function getMonthsAgoString(months: number): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setMonth(kst.getMonth() - months);
  return kst.toISOString().split('T')[0];
}

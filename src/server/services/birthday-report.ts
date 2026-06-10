export type BirthdayPatient = {
  name: string;
  display_name: string | null;
  room_number: string | null;
};

/**
 * 환자의 표시 이름과 호실 번호를 조합하여 레이블을 반환합니다.
 * @example "김철수(3012)" 또는 "이영희" (호실 없는 경우)
 */
function formatPatientLabel(patient: BirthdayPatient): string {
  const name = patient.display_name || patient.name;
  if (!patient.room_number) return name;
  return `${name}(${patient.room_number})`;
}

/**
 * 생일 환자 목록을 받아 슬랙 생일 축하 메시지 텍스트를 조립합니다.
 * 순수 함수 — 사이드이펙트 없음.
 *
 * @param patients - 오늘 생일인 활성 환자 목록
 * @param dateLabel - "6월 11일 (목)" 형식의 날짜 레이블
 */
export function composeBirthdayReportMessage(
  patients: BirthdayPatient[],
  dateLabel: string,
): string {
  if (patients.length === 0) return '';

  const headerLine = `\u{1F382} ${dateLabel}`;

  const nameList = patients.map(formatPatientLabel).join(', ');
  const suffix = patients.length > 1 ? '님들의' : '님의';
  const bodyLine = `오늘은 ${nameList} 회원${suffix} 생일입니다! 축하해주세요 \u{1F389}`;

  return [headerLine, bodyLine].join('\n');
}

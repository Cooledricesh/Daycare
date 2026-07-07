import type { AttendanceBoardResponse, BoardPatient } from '@/features/attendance-board/backend/schema';

const ABSENT_STATUS = 'absent' as const;
const ATTENDED_STATUS = 'attended' as const;

/**
 * 환자의 표시 이름과 호실 번호를 조합하여 레이블을 반환합니다.
 * @example "김철수(3012)" 또는 "이영희" (호실 없는 경우)
 */
function formatPatientLabel(patient: BoardPatient): string {
  const name = patient.display_name || patient.name;
  if (!patient.room_number) return name;
  return `${name}(${patient.room_number})`;
}

/**
 * AttendanceBoardResponse를 받아 슬랙 오후 진찰 현황 메시지 텍스트를 조립합니다.
 * 순수 함수 — 사이드이펙트 없음.
 *
 * @param board - 출석 보드 응답 데이터
 * @param dateLabel - "6월 10일 (수)" 형식의 날짜 레이블
 */
export function composeNoonReportMessage(
  board: AttendanceBoardResponse,
  dateLabel: string,
  options?: { clinicClosed?: boolean },
): string {
  const clinicClosed = options?.clinicClosed ?? false;
  const allPatients = board.rooms.flatMap((room) => room.patients);

  const absentPatients = allPatients.filter((p) => p.status === ABSENT_STATUS);
  const attendedNotConsultedPatients = allPatients.filter(
    (p) => p.status === ATTENDED_STATUS,
  );

  const attendedCount = board.total_attended;
  const scheduledCount = board.total_scheduled;
  const consultedCount = board.total_consulted;

  const headerLine = `\u{1F3E5} 낮병원 오후 진찰 현황 — ${dateLabel}`;
  // 휴진일에는 진찰 요약을 생략한다 (진찰 지표 제외).
  const summaryLine = clinicClosed
    ? `출석 ${attendedCount}/${scheduledCount} · 휴진일(진찰 없음)`
    : `출석 ${attendedCount}/${scheduledCount} · 진찰 ${consultedCount}/${attendedCount}`;

  const lines: string[] = [headerLine, summaryLine];

  // 미진찰 명단은 휴진일에는 표시하지 않는다. 미출석 명단은 항상 표시.
  if (absentPatients.length === 0 && (clinicClosed || attendedNotConsultedPatients.length === 0)) {
    lines.push('');
    lines.push(clinicClosed ? '\u{1F389} 전원 출석' : '\u{1F389} 전원 출석·진찰 완료');
    return lines.join('\n');
  }

  if (absentPatients.length > 0) {
    lines.push('');
    lines.push(`❌ 미내원 (${absentPatients.length}명)`);
    lines.push(absentPatients.map(formatPatientLabel).join(', '));
  }

  if (!clinicClosed && attendedNotConsultedPatients.length > 0) {
    lines.push('');
    lines.push(`\u{1FA7A} 출석 후 미진찰 (${attendedNotConsultedPatients.length}명)`);
    lines.push(attendedNotConsultedPatients.map(formatPatientLabel).join(', '));
  }

  return lines.join('\n');
}

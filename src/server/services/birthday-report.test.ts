import { describe, it, expect } from 'vitest';
import { composeBirthdayReportMessage } from './birthday-report';
import type { BirthdayPatient } from './birthday-report';

const DATE_LABEL = '6월 11일 (목)';

describe('composeBirthdayReportMessage', () => {
  it('1명: 단수 호칭("님의")과 호실 괄호가 올바르게 조립된다', () => {
    const patients: BirthdayPatient[] = [
      { name: '김철수', display_name: null, room_number: '3012' },
    ];
    const message = composeBirthdayReportMessage(patients, DATE_LABEL);

    expect(message).toContain('6월 11일 (목)');
    expect(message).toContain('김철수(3012) 회원님의 생일입니다!');
    expect(message).toContain('축하해주세요');
  });

  it('여러 명: 복수 호칭("님들의")과 쉼표 구분 목록이 올바르게 조립된다', () => {
    const patients: BirthdayPatient[] = [
      { name: '김철수', display_name: null, room_number: '3012' },
      { name: '이영희', display_name: null, room_number: '3013' },
    ];
    const message = composeBirthdayReportMessage(patients, DATE_LABEL);

    expect(message).toContain('6월 11일 (목)');
    expect(message).toContain('김철수(3012), 이영희(3013) 회원님들의 생일입니다!');
    expect(message).toContain('축하해주세요');
  });

  it('room_number null: 호실 없는 환자는 이름만 표시되고 괄호 표기가 생략된다', () => {
    const patients: BirthdayPatient[] = [
      { name: '박민수', display_name: null, room_number: null },
    ];
    const message = composeBirthdayReportMessage(patients, DATE_LABEL);

    expect(message).toContain('박민수 회원님의 생일입니다!');
    expect(message).not.toMatch(/박민수\(/);
  });

  it('display_name 우선: display_name이 있으면 name 대신 display_name이 표시된다', () => {
    const patients: BirthdayPatient[] = [
      { name: '홍길동', display_name: '길동이', room_number: '3021' },
    ];
    const message = composeBirthdayReportMessage(patients, DATE_LABEL);

    expect(message).toContain('길동이(3021) 회원님의 생일입니다!');
    expect(message).not.toContain('홍길동');
  });
});

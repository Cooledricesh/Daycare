import { describe, expect, it } from 'vitest';
import { inferDoctorName, parseSlackConsultationMessages } from './slack-consultation-ingest';

describe('parseSlackConsultationMessages', () => {
  const doctors = ['박명현', '이상철', '권도훈', '신정욱', '박상운', '이신화', '박승현'];

  it('진찰 제목 아래의 환자별 note를 파싱하고 의사명을 추론한다', () => {
    const entries = parseSlackConsultationMessages([
      {
        ts: '111.222',
        user: 'U123',
        text: `[박상운 원장님 진찰]\n홍길동: 혈압 확인 후 진찰 완료\n- 김영희: 보호자 통화 후 진찰함`,
      },
    ], doctors);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      patientName: '홍길동',
      doctorName: '박상운',
      messageTs: '111.222',
      sourceUser: 'U123',
    });
    expect(entries[0].note).toBe('혈압 확인 후 진찰 완료');
    expect(entries[1]).toMatchObject({ patientName: '김영희', doctorName: '박상운' });
  });

  it('환자 note의 다음 줄을 같은 환자의 note로 이어붙인다', () => {
    const entries = parseSlackConsultationMessages([
      {
        ts: '222.333',
        text: `권도훈 부원장님 진찰\n홍길동: 오전 진찰\n보호자 연락 필요\n김영희: 진찰 완료`,
      },
    ], doctors);

    expect(entries).toHaveLength(2);
    expect(entries[0].note).toBe('오전 진찰\n보호자 연락 필요');
    expect(entries[1].note).toBe('진찰 완료');
  });

  it('진찰이 없는 메시지는 무시한다', () => {
    const entries = parseSlackConsultationMessages([
      { ts: '333.444', text: '오늘 프로그램 공지\n홍길동: 참석' },
    ], doctors);

    expect(entries).toHaveLength(0);
  });
});

describe('inferDoctorName', () => {
  const doctors = ['박명현', '이상철', '권도훈', '신정욱', '박상운', '이신화', '박승현'];

  it('원장님 별칭을 주치의 이름으로 매핑한다', () => {
    expect(inferDoctorName('원장님 진찰 기록', doctors)).toBe('박상운');
    expect(inferDoctorName('권부원장님 진찰', doctors)).toBe('권도훈');
  });
});

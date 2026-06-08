import { describe, it, expect } from 'vitest';
import { parseRestDeItems } from './holiday-api';

describe('parseRestDeItems', () => {
  it('item 배열에서 공휴일(isHoliday=Y)만 ISO 날짜로 변환한다', () => {
    const body = {
      response: {
        body: {
          items: {
            item: [
              { dateName: '신정', isHoliday: 'Y', locdate: 20260101 },
              { dateName: '평일', isHoliday: 'N', locdate: 20260102 },
            ],
          },
        },
      },
    };
    expect(parseRestDeItems(body)).toEqual([{ date: '2026-01-01', reason: '신정' }]);
  });

  it('item이 단일 객체여도 처리한다', () => {
    const body = {
      response: { body: { items: { item: { dateName: '어린이날', isHoliday: 'Y', locdate: '20260505' } } } },
    };
    expect(parseRestDeItems(body)).toEqual([{ date: '2026-05-05', reason: '어린이날' }]);
  });

  it('빈 응답(item 없음 / 빈 문자열)은 빈 배열을 반환한다', () => {
    expect(parseRestDeItems({ response: { body: { items: '' } } })).toEqual([]);
    expect(parseRestDeItems({})).toEqual([]);
    expect(parseRestDeItems(null)).toEqual([]);
  });

  it('잘못된 locdate는 건너뛴다', () => {
    const body = {
      response: { body: { items: { item: [{ dateName: '이상', isHoliday: 'Y', locdate: 'bad' }] } } },
    };
    expect(parseRestDeItems(body)).toEqual([]);
  });
});

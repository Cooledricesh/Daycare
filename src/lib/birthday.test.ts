import { describe, it, expect } from 'vitest';
import {
  formatBirthDateShort,
  calculateKoreanAge,
  isBirthdayToday,
  daysUntilNextBirthday,
} from './birthday';

describe('formatBirthDateShort', () => {
  it('YYYY-MM-DD를 M/D 포맷으로 반환한다', () => {
    expect(formatBirthDateShort('1974-03-15')).toBe('3/15');
  });

  it('한 자리 일/월도 그대로 유지한다', () => {
    expect(formatBirthDateShort('1990-01-05')).toBe('1/5');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatBirthDateShort(null)).toBe('');
  });
});

describe('calculateKoreanAge', () => {
  it('생일이 지나면 만 나이 그대로', () => {
    expect(calculateKoreanAge('1974-03-15', new Date('2026-04-11'))).toBe(52);
  });

  it('생일이 아직 안 왔으면 만 나이 -1', () => {
    expect(calculateKoreanAge('1974-05-15', new Date('2026-04-11'))).toBe(51);
  });

  it('오늘이 생일이면 만 나이 적용', () => {
    expect(calculateKoreanAge('1974-04-11', new Date('2026-04-11'))).toBe(52);
  });

  it('윤년 2/29 생일은 평년에 3/1로 취급', () => {
    expect(calculateKoreanAge('2000-02-29', new Date('2025-02-28'))).toBe(24);
    expect(calculateKoreanAge('2000-02-29', new Date('2025-03-01'))).toBe(25);
  });

  it('null이면 null 반환', () => {
    expect(calculateKoreanAge(null)).toBeNull();
  });
});

describe('isBirthdayToday', () => {
  it('오늘이 생일이면 true', () => {
    expect(isBirthdayToday('1974-04-11', new Date('2026-04-11'))).toBe(true);
  });

  it('다른 날이면 false', () => {
    expect(isBirthdayToday('1974-04-10', new Date('2026-04-11'))).toBe(false);
  });

  it('윤년 2/29 생일은 평년엔 2/28에 true', () => {
    expect(isBirthdayToday('2000-02-29', new Date('2025-02-28'))).toBe(true);
  });

  it('null이면 false', () => {
    expect(isBirthdayToday(null)).toBe(false);
  });
});

describe('daysUntilNextBirthday', () => {
  it('생일까지 남은 일수', () => {
    expect(daysUntilNextBirthday('1974-04-15', new Date('2026-04-11'))).toBe(4);
  });

  it('오늘이면 0', () => {
    expect(daysUntilNextBirthday('1974-04-11', new Date('2026-04-11'))).toBe(0);
  });

  it('생일 지났으면 내년 생일까지', () => {
    const today = new Date('2026-04-11');
    expect(daysUntilNextBirthday('1974-03-15', today)).toBeGreaterThan(300);
  });
});

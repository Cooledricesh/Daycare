import { describe, it, expect } from 'vitest';
import {
  detectClosureDates,
  calculateConsecutiveAttendance,
} from './streak';

describe('detectClosureDates', () => {
  it('평일인데 전체 출석자 0명인 날을 휴원으로 감지한다', () => {
    // 2026-06-04(목),06-05(금),06-08(월) 출석. 06-03(수)는 전원 미출석=휴원.
    const attended = new Set(['2026-06-04', '2026-06-05', '2026-06-08']);
    const closures = detectClosureDates(attended, '2026-06-01', '2026-06-08');
    expect(closures.has('2026-06-03')).toBe(true); // 수요일 휴원
    expect(closures.has('2026-06-02')).toBe(true); // 화요일도 출석기록 없음 → 휴원 취급
  });

  it('endDate(오늘)는 휴원으로 감지하지 않는다', () => {
    const attended = new Set<string>();
    const closures = detectClosureDates(attended, '2026-06-08', '2026-06-08');
    expect(closures.has('2026-06-08')).toBe(false);
  });

  it('주말은 휴원으로 감지하지 않는다', () => {
    const attended = new Set<string>();
    const closures = detectClosureDates(attended, '2026-06-06', '2026-06-08');
    expect(closures.has('2026-06-06')).toBe(false); // 토
    expect(closures.has('2026-06-07')).toBe(false); // 일
  });
});

describe('calculateConsecutiveAttendance — 휴원일 건너뛰기', () => {
  const patternDows = new Set([1, 2, 3, 4, 5]); // 평일 패턴
  const empty = new Set<string>();
  const created = '2026-01-01';

  it('휴원일(holiday)이 등록되면 스트릭이 그날을 건너뛰어 이어진다', () => {
    // 06-08(월),06-05(금),06-04(목) 출석. 06-03(수)=휴원. 06-02(화),06-01(월) 출석.
    const attended = new Set(['2026-06-08', '2026-06-05', '2026-06-04', '2026-06-02', '2026-06-01']);
    const holidays = new Map<string, string>([['2026-06-03', '지방선거']]);
    const streak = calculateConsecutiveAttendance(
      empty, empty, patternDows, attended, created, holidays, '2026-06-08',
    );
    // 06-08,05,04 + (06-03 skip) + 06-02,01 = 5
    expect(streak).toBe(5);
  });

  it('휴원일이 등록되지 않으면 그 평일에서 스트릭이 끊긴다 (버그 재현)', () => {
    const attended = new Set(['2026-06-08', '2026-06-05', '2026-06-04', '2026-06-02', '2026-06-01']);
    const noHolidays = new Map<string, string>();
    const streak = calculateConsecutiveAttendance(
      empty, empty, patternDows, attended, created, noHolidays, '2026-06-08',
    );
    // 06-08,05,04 까지 후 06-03(수, 평일, 예정, 미출석)에서 break = 3
    expect(streak).toBe(3);
  });
});

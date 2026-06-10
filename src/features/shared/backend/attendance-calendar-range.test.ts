import { describe, it, expect } from 'vitest';
import { groupAttendanceByMonth, ATTENDANCE_CALENDAR_RANGE_MAX_MONTHS } from './route';

describe('groupAttendanceByMonth', () => {
  it('단일 월에 대한 데이터를 올바르게 그룹핑한다', () => {
    const result = groupAttendanceByMonth({
      fromYear: 2026, fromMonth: 6,
      toYear: 2026, toMonth: 6,
      attendances: [{ date: '2026-06-01' }, { date: '2026-06-02' }],
      scheduledAttendances: [
        { date: '2026-06-01', is_cancelled: false },
        { date: '2026-06-03', is_cancelled: true },
      ],
      consultations: [{ date: '2026-06-01' }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].year).toBe(2026);
    expect(result[0].month).toBe(6);
    expect(result[0].attended_dates).toEqual(['2026-06-01', '2026-06-02']);
    expect(result[0].scheduled_dates).toEqual(['2026-06-01']);
    expect(result[0].consulted_dates).toEqual(['2026-06-01']);
  });

  it('취소된 예정 출석은 scheduled_dates에 포함하지 않는다', () => {
    const result = groupAttendanceByMonth({
      fromYear: 2026, fromMonth: 6,
      toYear: 2026, toMonth: 6,
      attendances: [],
      scheduledAttendances: [
        { date: '2026-06-10', is_cancelled: true },
        // is_cancelled: null 은 falsy → 취소 아님으로 간주 (포함)
        { date: '2026-06-11', is_cancelled: null },
        { date: '2026-06-12', is_cancelled: false },
      ],
      consultations: [],
    });

    // is_cancelled: true인 06-10만 제외, null과 false는 포함
    expect(result[0].scheduled_dates).toEqual(['2026-06-11', '2026-06-12']);
  });

  it('여러 달에 걸친 데이터를 월별로 정확히 분리한다', () => {
    const result = groupAttendanceByMonth({
      fromYear: 2026, fromMonth: 5,
      toYear: 2026, toMonth: 7,
      attendances: [
        { date: '2026-05-15' },
        { date: '2026-06-10' },
        { date: '2026-07-20' },
      ],
      scheduledAttendances: [],
      consultations: [],
    });

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ year: 2026, month: 5, attended_dates: ['2026-05-15'] });
    expect(result[1]).toMatchObject({ year: 2026, month: 6, attended_dates: ['2026-06-10'] });
    expect(result[2]).toMatchObject({ year: 2026, month: 7, attended_dates: ['2026-07-20'] });
  });

  it('연도 경계를 올바르게 처리한다 (12월 → 1월)', () => {
    const result = groupAttendanceByMonth({
      fromYear: 2025, fromMonth: 12,
      toYear: 2026, toMonth: 2,
      attendances: [
        { date: '2025-12-31' },
        { date: '2026-01-01' },
        { date: '2026-02-01' },
      ],
      scheduledAttendances: [],
      consultations: [],
    });

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ year: 2025, month: 12, attended_dates: ['2025-12-31'] });
    expect(result[1]).toMatchObject({ year: 2026, month: 1, attended_dates: ['2026-01-01'] });
    expect(result[2]).toMatchObject({ year: 2026, month: 2, attended_dates: ['2026-02-01'] });
  });

  it('해당 월에 데이터가 없으면 빈 배열로 반환한다', () => {
    const result = groupAttendanceByMonth({
      fromYear: 2026, fromMonth: 1,
      toYear: 2026, toMonth: 3,
      attendances: [{ date: '2026-02-14' }],
      scheduledAttendances: [],
      consultations: [],
    });

    expect(result).toHaveLength(3);
    expect(result[0].attended_dates).toHaveLength(0);
    expect(result[1].attended_dates).toEqual(['2026-02-14']);
    expect(result[2].attended_dates).toHaveLength(0);
  });

  it('동일 월의 여러 날짜를 모두 포함한다', () => {
    const dates = ['2026-06-01', '2026-06-05', '2026-06-10', '2026-06-20', '2026-06-30'];
    const result = groupAttendanceByMonth({
      fromYear: 2026, fromMonth: 6,
      toYear: 2026, toMonth: 6,
      attendances: dates.map((date) => ({ date })),
      scheduledAttendances: [],
      consultations: [],
    });

    expect(result[0].attended_dates).toHaveLength(5);
    expect(result[0].attended_dates).toEqual(dates);
  });

  it('ATTENDANCE_CALENDAR_RANGE_MAX_MONTHS 상수가 24이다', () => {
    expect(ATTENDANCE_CALENDAR_RANGE_MAX_MONTHS).toBe(24);
  });
});

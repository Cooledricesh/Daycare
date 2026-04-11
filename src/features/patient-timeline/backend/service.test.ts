import { describe, it, expect } from 'vitest';
import { buildTimelineEvents } from './service';

describe('buildTimelineEvents', () => {
  it('입원 이벤트를 첫 날로 생성', () => {
    const events = buildTimelineEvents({
      patient: {
        id: 'p1',
        created_at: '2026-01-10T00:00:00Z',
        birth_date: null,
        status: 'active',
        updated_at: '2026-04-11T00:00:00Z',
      },
      attendances: [],
      scheduledAttendances: [],
      consultations: [],
      messages: [],
      today: new Date('2026-04-11'),
    });

    expect(events.some((e) => e.type === 'admission' && e.date === '2026-01-10')).toBe(true);
  });

  it('출석/진찰/메시지/결석 이벤트 포함', () => {
    const events = buildTimelineEvents({
      patient: { id: 'p1', created_at: '2026-04-01T00:00:00Z', birth_date: null, status: 'active', updated_at: '2026-04-11T00:00:00Z' },
      attendances: [{ date: '2026-04-05' }],
      scheduledAttendances: [{ date: '2026-04-05' }, { date: '2026-04-07' }],
      consultations: [{ date: '2026-04-05' }],
      messages: [{ created_at: '2026-04-05T10:00:00Z' }],
      today: new Date('2026-04-11'),
    });

    expect(events.some((e) => e.type === 'attendance' && e.date === '2026-04-05')).toBe(true);
    expect(events.some((e) => e.type === 'consultation' && e.date === '2026-04-05')).toBe(true);
    expect(events.some((e) => e.type === 'message' && e.date === '2026-04-05')).toBe(true);
    expect(events.some((e) => e.type === 'absence' && e.date === '2026-04-07')).toBe(true);
  });

  it('생일 이벤트는 입원~오늘 사이의 생일만 포함', () => {
    const events = buildTimelineEvents({
      patient: { id: 'p1', created_at: '2025-06-01T00:00:00Z', birth_date: '1974-03-15', status: 'active', updated_at: '2026-04-11T00:00:00Z' },
      attendances: [],
      scheduledAttendances: [],
      consultations: [],
      messages: [],
      today: new Date('2026-04-11'),
    });

    const birthdayEvents = events.filter((e) => e.type === 'birthday');
    expect(birthdayEvents).toHaveLength(1);
    expect(birthdayEvents[0].date).toBe('2026-03-15');
  });

  it('discharged 상태면 퇴원 이벤트 생성', () => {
    const events = buildTimelineEvents({
      patient: { id: 'p1', created_at: '2026-01-01T00:00:00Z', birth_date: null, status: 'discharged', updated_at: '2026-03-20T00:00:00Z' },
      attendances: [],
      scheduledAttendances: [],
      consultations: [],
      messages: [],
      today: new Date('2026-04-11'),
    });

    expect(events.some((e) => e.type === 'discharge' && e.date === '2026-03-20')).toBe(true);
  });
});

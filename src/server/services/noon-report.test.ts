import { describe, it, expect } from 'vitest';
import { composeNoonReportMessage } from './noon-report';
import type { AttendanceBoardResponse, BoardPatient, RoomGroup } from '@/features/attendance-board/backend/schema';

function makePatient(overrides: Partial<BoardPatient>): BoardPatient {
  return {
    id: 'p-1',
    name: '홍길동',
    display_name: null,
    gender: null,
    avatar_url: null,
    room_number: '3001',
    status: 'attended_consulted',
    is_attended: true,
    attendance_time: '09:00',
    is_scheduled: true,
    is_consulted: true,
    has_task: false,
    task_completed: false,
    attendance_streak: 0,
    consultation_streak: 0,
    streak_tier: 'none',
    ...overrides,
  };
}

function makeBoard(
  patients: BoardPatient[],
  overrides?: Partial<AttendanceBoardResponse>,
): AttendanceBoardResponse {
  const attended = patients.filter((p) => p.is_attended).length;
  const scheduled = patients.filter((p) => p.is_scheduled).length;
  const consulted = patients.filter((p) => p.is_consulted).length;

  const room: RoomGroup = {
    room_prefix: '3001',
    coordinator_name: null,
    patients,
    attended_count: attended,
    scheduled_count: scheduled,
    consulted_count: consulted,
    unscheduled_attended_count: 0,
    total_count: patients.length,
  };

  return {
    date: '2026-06-10',
    rooms: [room],
    total_attended: attended,
    total_scheduled: scheduled,
    total_consulted: consulted,
    total_unscheduled_attended: 0,
    total_count: patients.length,
    ...overrides,
  };
}

describe('composeNoonReportMessage', () => {
  it('정상 케이스: 미출석/미진찰 환자가 있을 때 전체 메시지를 조립한다', () => {
    // absent 환자는 is_attended=false, is_scheduled=true (예약됐으나 미출석)
    const patients: BoardPatient[] = [
      makePatient({ id: 'p-1', name: '김철수', room_number: '3012', status: 'absent', is_attended: false, is_scheduled: true, is_consulted: false }),
      makePatient({ id: 'p-2', name: '이영희', room_number: '3013', status: 'absent', is_attended: false, is_scheduled: true, is_consulted: false }),
      makePatient({ id: 'p-3', name: '박민수', room_number: '3021', status: 'attended', is_attended: true, is_scheduled: true, is_consulted: false }),
      makePatient({ id: 'p-4', name: '최지원', room_number: '3022', status: 'attended_consulted', is_attended: true, is_scheduled: true, is_consulted: true }),
    ];
    const board = makeBoard(patients);
    const message = composeNoonReportMessage(board, '6월 10일 (수)');

    expect(message).toContain('낮병원 정오 현황 — 6월 10일 (수)');
    // attended=2, scheduled=4, consulted=1
    expect(message).toContain('출석 2/4 · 진찰 1/2');
    expect(message).toContain('미출석 (2명)');
    expect(message).toContain('김철수(3012)');
    expect(message).toContain('이영희(3013)');
    expect(message).toContain('출석 후 미진찰 (1명)');
    expect(message).toContain('박민수(3021)');
    expect(message).not.toContain('전원 출석·진찰 완료');
  });

  it('미출석 0명: 미출석 섹션이 생략되고 미진찰 섹션만 출력된다', () => {
    const patients: BoardPatient[] = [
      makePatient({ id: 'p-1', name: '강동원', room_number: '3011', status: 'attended', is_attended: true, is_consulted: false }),
      makePatient({ id: 'p-2', name: '손예진', room_number: '3012', status: 'attended_consulted', is_attended: true, is_consulted: true }),
    ];
    const board = makeBoard(patients);
    const message = composeNoonReportMessage(board, '6월 10일 (수)');

    expect(message).not.toContain('미출석');
    expect(message).toContain('출석 후 미진찰 (1명)');
    expect(message).toContain('강동원(3011)');
  });

  it('전원 완료: 미출석/미진찰 모두 0명이면 "전원 출석·진찰 완료" 한 줄만 출력된다', () => {
    const patients: BoardPatient[] = [
      makePatient({ id: 'p-1', name: '유재석', room_number: '3001', status: 'attended_consulted', is_attended: true, is_consulted: true }),
      makePatient({ id: 'p-2', name: '강호동', room_number: '3002', status: 'attended_consulted', is_attended: true, is_consulted: true }),
    ];
    const board = makeBoard(patients);
    const message = composeNoonReportMessage(board, '6월 10일 (수)');

    expect(message).toContain('전원 출석·진찰 완료');
    expect(message).not.toContain('미출석');
    expect(message).not.toContain('미진찰');
  });

  it('room_number null: 호실 없는 환자는 이름만 표시되고 괄호 표기가 생략된다', () => {
    const patients: BoardPatient[] = [
      makePatient({ id: 'p-1', name: '테스트환자', display_name: '홍길동', room_number: null, status: 'absent', is_attended: false, is_consulted: false }),
    ];
    const board = makeBoard(patients);
    const message = composeNoonReportMessage(board, '6월 10일 (수)');

    // display_name이 있으면 display_name 사용, 괄호 없음
    expect(message).toContain('홍길동');
    expect(message).not.toMatch(/홍길동\(/);
  });

  it('휴진일: 미진찰 섹션·진찰 요약을 생략하고 휴진 표기를 노출한다', () => {
    const patients: BoardPatient[] = [
      makePatient({ id: 'p-1', name: '강동원', room_number: '3011', status: 'attended', is_attended: true, is_consulted: false }),
      makePatient({ id: 'p-2', name: '원빈', room_number: '3012', status: 'attended', is_attended: true, is_consulted: false }),
    ];
    const board = makeBoard(patients);
    const message = composeNoonReportMessage(board, '7월 6일 (월)', { clinicClosed: true });

    expect(message).toContain('휴진일');
    expect(message).not.toContain('미진찰');
    expect(message).not.toMatch(/진찰 \d+\/\d+/);
  });

  it('휴진일이어도 미출석 명단은 그대로 발송한다', () => {
    const patients: BoardPatient[] = [
      makePatient({ id: 'p-1', name: '김결석', room_number: '3011', status: 'absent', is_attended: false, is_scheduled: true, is_consulted: false }),
      makePatient({ id: 'p-2', name: '원빈', room_number: '3012', status: 'attended', is_attended: true, is_consulted: false }),
    ];
    const board = makeBoard(patients);
    const message = composeNoonReportMessage(board, '7월 6일 (월)', { clinicClosed: true });

    expect(message).toContain('미출석');
    expect(message).toContain('김결석');
    expect(message).not.toContain('미진찰');
  });
});

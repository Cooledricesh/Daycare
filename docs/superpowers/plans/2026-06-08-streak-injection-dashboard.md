# 연속출석 확장·스트릭 버그 수정·주사제 의사화면 표시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) 휴원일 미등록으로 끊기는 연속출석 스트릭을 자동 감지+공휴일 등록으로 고치고, (B) 스트릭을 4개 직역 대시보드 환자 목록 카드에 뱃지로 노출하며, (C) 의사 진료 패널에 환자별 주사제 이력(회차·날짜)과 다음 예정일을 표시한다.

**Architecture:** 스트릭 계산 로직을 `attendance-board` 서비스에서 공유 모듈(`shared/backend/streak.ts` + `shared/lib/streak-tier.ts`)로 추출해 단일 출처화한다. 자동 휴원 감지(평일·전체출석 0명)를 추가하고 `holidays`와 합산한다. 신규 `GET /attendance-board/streaks` 배치 엔드포인트 + `useStreaks` 훅으로 4개 대시보드에 뱃지를 오버레이한다(역할 서비스 미변경). 주사제 이력은 Carescheduler에 신규 외부 엔드포인트를 추가하고 Daycare BFF가 중계한다.

**Tech Stack:** Next.js(App Router), Hono, Supabase, React Query, zod, date-fns, vitest, Tailwind, shadcn-ui. Carescheduler는 별도 Next.js 프로젝트(`/Users/seunghyun/Carescheduler`).

---

## File Structure

**Part A — 스트릭 버그 수정 / 공유 모듈 추출**
- Create: `src/features/shared/lib/streak-tier.ts` — `StreakTier` 타입, 임계값, `getStreakTier`, 등급 메타(아이콘/색상/라벨) 단일 출처
- Create: `src/features/shared/backend/streak.ts` — 순수 계산(이동) + 자동 휴원 감지 + 전 환자 스트릭 계산 로더
- Create: `src/features/shared/backend/streak.test.ts` — 순수 로직 단위 테스트
- Modify: `src/features/attendance-board/backend/service.ts` — 인라인 스트릭 로직 제거, 공유 모듈 사용
- Modify: `src/features/attendance-board/backend/schema.ts` — `StreakTier`를 공유 모듈에서 재노출
- Create: `supabase/migrations/20260608000000_seed_holidays_2026.sql` — 2026 공휴일/휴원일 시드 (실제 prefix는 기존 최신 파일 다음 타임스탬프로)

**Part B — 직역 대시보드 스트릭 뱃지**
- Create: `src/features/shared/components/StreakBadge.tsx` — 목록용 압축 뱃지
- Modify: `src/features/attendance-board/components/StreakEffect.tsx` — 아이콘/색상을 공유 메타에서 사용(중복 제거)
- Modify: `src/features/attendance-board/backend/route.ts` — `GET /streaks` 추가
- Create: `src/features/attendance-board/backend/streaks-schema.ts` — streaks 응답 타입
- Modify: `src/features/attendance-board/backend/service.ts` — `getStreaksMap` export
- Create: `src/features/attendance-board/hooks/useStreaks.ts` — React Query 훅
- Create: `src/features/attendance-board/hooks/streak-keys.ts` — query key
- Modify: `src/features/doctor/components/PatientListPanel.tsx`
- Modify: `src/features/nurse/components/NursePatientListPanel.tsx`
- Modify: `src/features/staff/components/StaffPatientListPanel.tsx`
- Modify: `src/features/admin/components/AdminPatientListPanel.tsx`

**Part C — 주사제 이력 의사화면**
- Create (Carescheduler): `/Users/seunghyun/Carescheduler/src/app/api/external/injections/history/route.ts`
- Modify: `src/server/integrations/carescheduler/schema.ts` — 이력 응답 스키마
- Modify: `src/server/integrations/carescheduler/client.ts` — `fetchInjectionHistoryByPatientNumber`
- Modify: `src/features/injections/backend/schema.ts` — BFF 이력 스키마
- Modify: `src/features/injections/backend/service.ts` — `getPatientInjectionHistory`
- Modify: `src/features/injections/backend/route.ts` — `GET /patient/:patientId/history`
- Modify: `src/features/injections/lib/dto.ts` — 이력 타입 재노출
- Modify: `src/features/injections/hooks/query-keys.ts` — history key
- Create: `src/features/injections/hooks/usePatientInjectionHistory.ts`
- Create: `src/features/injections/components/PatientInjectionHistoryCard.tsx`
- Modify: `src/features/doctor/components/ConsultationPanel.tsx` — 카드 삽입

---

# PART A — 스트릭 버그 수정 + 공유 모듈 추출

### Task A1: 등급 단일 출처 모듈 생성

**Files:**
- Create: `src/features/shared/lib/streak-tier.ts`

- [ ] **Step 1: 모듈 작성**

```typescript
/** 스트릭 등급 (낮병원 연속 출석/진찰 게이미피케이션) */
export type StreakTier = 'none' | 'fire' | 'lightning' | 'diamond' | 'crown' | 'myth';

/** 등급 임계값 (연속 출석 일수) — 단일 출처 */
export const STREAK_THRESHOLDS: ReadonlyArray<{ tier: Exclude<StreakTier, 'none'>; min: number }> = [
  { tier: 'myth', min: 30 },
  { tier: 'crown', min: 20 },
  { tier: 'diamond', min: 10 },
  { tier: 'lightning', min: 5 },
  { tier: 'fire', min: 3 },
];

/** 스트릭 뱃지 표시 최소 일수 */
export const STREAK_BADGE_MIN = 3;

/** 연속 일수 → 등급 */
export function getStreakTier(streak: number): StreakTier {
  for (const { tier, min } of STREAK_THRESHOLDS) {
    if (streak >= min) return tier;
  }
  return 'none';
}

/** 등급별 UI 메타 (아이콘/색상/라벨) — 단일 출처 */
export const STREAK_TIER_META: Record<
  Exclude<StreakTier, 'none'>,
  { icon: string; bg: string; border: string; text: string; label: string }
> = {
  fire: { icon: '🔥', bg: '#fff3e0', border: '#e65100', text: '#e65100', label: '시작!' },
  lightning: { icon: '⚡', bg: '#fff8e1', border: '#f9a825', text: '#f57f17', label: '달리는 중!' },
  diamond: { icon: '💎', bg: '#e3f2fd', border: '#1565c0', text: '#0d47a1', label: '다이아몬드!' },
  crown: { icon: '👑', bg: '#fff8e1', border: '#ff8f00', text: '#e65100', label: '전설!' },
  myth: { icon: '🌟', bg: 'linear-gradient(90deg, #fce4ec, #e8eaf6, #e0f7fa)', border: '#7b1fa2', text: '#4a148c', label: '신화!' },
};
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 신규 파일 관련 오류 없음 (기존 오류만 있을 수 있음)

- [ ] **Step 3: 커밋**

```bash
git add src/features/shared/lib/streak-tier.ts
git commit -m "feat(streak): 스트릭 등급 단일 출처 모듈 추가"
```

---

### Task A2: 공유 스트릭 모듈 작성 (계산 이동 + 자동 휴원 감지)

**Files:**
- Create: `src/features/shared/backend/streak.ts`

- [ ] **Step 1: 모듈 작성** — 계산 함수는 기존 `attendance-board/backend/service.ts`에서 동작 동일하게 이동하고, 자동 휴원 감지(`detectClosureDates`)와 전 환자 로더(`getStreaksMap`)를 추가한다.

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { fetchAllPaginated } from '@/lib/supabase-pagination';
import { isWeekend, getHolidayDatesMap } from '@/lib/business-days';
import { format, subDays, parseISO } from 'date-fns';
import { getStreakTier, type StreakTier } from '@/features/shared/lib/streak-tier';

export type PatientStreaks = {
  attendance_streak: number;
  consultation_streak: number;
  streak_tier: StreakTier;
};

/** 스트릭 계산 윈도우 (일) */
const STREAK_WINDOW_DAYS = 60;

/**
 * 해당 날짜가 환자에게 "예정"된 날인지 판단
 * - scheduled_attendances(is_cancelled=false) 재료화 row가 있으면 예정
 * - 없어도 scheduled_patterns 요일 매칭이면 예정 (history backfill)
 * - is_cancelled=true 재료화 row가 있으면 취소로 처리 → !예정
 * - 환자 등록일 이전은 예정 아님
 */
export function isScheduledOnDate(
  dateStr: string,
  dow: number,
  scheduledMaterialized: Set<string>,
  cancelledMaterialized: Set<string>,
  patternDows: Set<number>,
  patientCreatedDate: string,
): boolean {
  if (dateStr < patientCreatedDate) return false;
  if (cancelledMaterialized.has(dateStr)) return false;
  return scheduledMaterialized.has(dateStr) || patternDows.has(dow);
}

/**
 * 자동 휴원일 감지: 윈도우 내 "평일이지만 전체 출석자가 0명"인 날을 휴원일로 간주.
 * - endDate(오늘)는 제외 (오전 중 미출석 상태를 휴원으로 오인 방지)
 * - 주말은 제외 (어차피 스트릭 계산에서 skip)
 */
export function detectClosureDates(
  attendedDatesAnyPatient: Set<string>,
  startDate: string,
  endDate: string,
): Set<string> {
  const closures = new Set<string>();
  let cursor = parseISO(endDate);
  // endDate 제외하고 하루 전부터 시작
  cursor = subDays(cursor, 1);
  while (true) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    if (dateStr < startDate) break;
    if (!isWeekend(dateStr) && !attendedDatesAnyPatient.has(dateStr)) {
      closures.add(dateStr);
    }
    cursor = subDays(cursor, 1);
  }
  return closures;
}

/**
 * 연속 출석 일수 계산 (오늘 포함, 역순)
 * - 출석 기록 있으면 무조건 카운트
 * - 주말/공휴일(holidayMap, 자동 휴원 포함) 미출석이면 skip
 * - 평일 미출석 + 예정된 날 → break
 * - 평일 미출석 + 예정 아님 → skip
 * - 환자 등록일 이전이면 종료
 */
export function calculateConsecutiveAttendance(
  scheduledMaterialized: Set<string>,
  cancelledMaterialized: Set<string>,
  patternDows: Set<number>,
  attendedDates: Set<string>,
  patientCreatedDate: string,
  holidayMap: Map<string, string>,
  endDate: string,
): number {
  let count = 0;
  let cursor = parseISO(endDate);

  for (let i = 0; i < 365; i++) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    if (patientCreatedDate && dateStr < patientCreatedDate) break;

    const isAttended = attendedDates.has(dateStr);
    if (isAttended) {
      count++;
      cursor = subDays(cursor, 1);
      continue;
    }

    const isHolidayOrWeekend = isWeekend(dateStr) || holidayMap.has(dateStr);
    if (isHolidayOrWeekend) {
      cursor = subDays(cursor, 1);
      continue;
    }

    const isScheduled = isScheduledOnDate(
      dateStr, cursor.getDay(), scheduledMaterialized, cancelledMaterialized, patternDows, patientCreatedDate,
    );
    if (isScheduled) break;

    cursor = subDays(cursor, 1);
  }
  return count;
}

/**
 * 연속 진찰 일수 계산
 * - 주말/공휴일: 출석했으면 카운트, 미출석이면 skip
 * - 평일 출석+진찰 → 카운트, 평일 출석+미진찰 → break
 * - 평일 미출석 + 예정 → break, 예정 아님 → skip
 */
export function calculateConsecutiveConsultation(
  scheduledMaterialized: Set<string>,
  cancelledMaterialized: Set<string>,
  patternDows: Set<number>,
  attendedDates: Set<string>,
  consultedDates: Set<string>,
  patientCreatedDate: string,
  holidayMap: Map<string, string>,
  endDate: string,
): number {
  let count = 0;
  let cursor = parseISO(endDate);

  for (let i = 0; i < 365; i++) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    if (patientCreatedDate && dateStr < patientCreatedDate) break;

    const isAttended = attendedDates.has(dateStr);
    const isHolidayOrWeekend = isWeekend(dateStr) || holidayMap.has(dateStr);

    if (isHolidayOrWeekend) {
      if (isAttended) count++;
      cursor = subDays(cursor, 1);
      continue;
    }

    if (isAttended) {
      if (!consultedDates.has(dateStr)) break;
      count++;
      cursor = subDays(cursor, 1);
      continue;
    }

    const isScheduled = isScheduledOnDate(
      dateStr, cursor.getDay(), scheduledMaterialized, cancelledMaterialized, patternDows, patientCreatedDate,
    );
    if (isScheduled) break;

    cursor = subDays(cursor, 1);
  }
  return count;
}

/**
 * 전 활성 환자의 raw 스트릭 맵을 계산한다 (today별 표시 보정은 호출측 책임).
 * - 60일 윈도우 데이터를 페이지네이션으로 로드
 * - holidays + 자동 휴원 감지를 합산
 */
export async function getStreaksMap(
  supabase: SupabaseClient<Database>,
  endDate: string,
  patients: Array<{ id: string; created_at: string | null }>,
): Promise<Map<string, PatientStreaks>> {
  const startDate = format(subDays(parseISO(endDate), STREAK_WINDOW_DAYS), 'yyyy-MM-dd');

  const [allAttendances, allConsultations, allScheduled, allPatterns, holidayMap] = await Promise.all([
    fetchAllPaginated<{ patient_id: string; date: string }>(() =>
      supabase.from('attendances').select('patient_id, date').gte('date', startDate).lte('date', endDate).order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; date: string }>(() =>
      supabase.from('consultations').select('patient_id, date').gte('date', startDate).lte('date', endDate).order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; date: string; is_cancelled: boolean }>(() =>
      supabase.from('scheduled_attendances').select('patient_id, date, is_cancelled').gte('date', startDate).lte('date', endDate).order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; day_of_week: number }>(() =>
      supabase.from('scheduled_patterns').select('patient_id, day_of_week').eq('is_active', true).order('id'),
    ),
    getHolidayDatesMap(supabase, startDate, endDate),
  ]);

  const patientAttendanceDates = new Map<string, Set<string>>();
  const patientConsultationDates = new Map<string, Set<string>>();
  const patientScheduledDates = new Map<string, Set<string>>();
  const patientCancelledDates = new Map<string, Set<string>>();
  const patientPatternDows = new Map<string, Set<number>>();
  const attendedDatesAnyPatient = new Set<string>();

  for (const a of allAttendances ?? []) {
    const set = patientAttendanceDates.get(a.patient_id) ?? new Set<string>();
    set.add(a.date);
    patientAttendanceDates.set(a.patient_id, set);
    attendedDatesAnyPatient.add(a.date);
  }
  for (const c of allConsultations ?? []) {
    const set = patientConsultationDates.get(c.patient_id) ?? new Set<string>();
    set.add(c.date);
    patientConsultationDates.set(c.patient_id, set);
  }
  for (const s of allScheduled ?? []) {
    const target = s.is_cancelled ? patientCancelledDates : patientScheduledDates;
    const set = target.get(s.patient_id) ?? new Set<string>();
    set.add(s.date);
    target.set(s.patient_id, set);
  }
  for (const p of allPatterns ?? []) {
    const set = patientPatternDows.get(p.patient_id) ?? new Set<number>();
    set.add(p.day_of_week);
    patientPatternDows.set(p.patient_id, set);
  }

  // 자동 휴원 감지 → holidayMap에 합산
  const closures = detectClosureDates(attendedDatesAnyPatient, startDate, endDate);
  for (const d of closures) {
    if (!holidayMap.has(d)) holidayMap.set(d, '자동 휴원 감지');
  }

  const result = new Map<string, PatientStreaks>();
  for (const patient of patients) {
    const pScheduled = patientScheduledDates.get(patient.id) ?? new Set<string>();
    const pCancelled = patientCancelledDates.get(patient.id) ?? new Set<string>();
    const pAttended = patientAttendanceDates.get(patient.id) ?? new Set<string>();
    const pConsulted = patientConsultationDates.get(patient.id) ?? new Set<string>();
    const pPatternDows = patientPatternDows.get(patient.id) ?? new Set<number>();
    const createdDate = (patient.created_at ?? '').slice(0, 10);

    const attendance_streak = calculateConsecutiveAttendance(
      pScheduled, pCancelled, pPatternDows, pAttended, createdDate, holidayMap, endDate,
    );
    const consultation_streak = calculateConsecutiveConsultation(
      pScheduled, pCancelled, pPatternDows, pAttended, pConsulted, createdDate, holidayMap, endDate,
    );
    result.set(patient.id, {
      attendance_streak,
      consultation_streak,
      streak_tier: getStreakTier(attendance_streak),
    });
  }
  return result;
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 신규 파일 관련 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add src/features/shared/backend/streak.ts
git commit -m "feat(streak): 공유 스트릭 계산 모듈 + 자동 휴원 감지 추가"
```

---

### Task A3: 공유 스트릭 모듈 단위 테스트 (버그 재현 + 수정 검증)

**Files:**
- Create: `src/features/shared/backend/streak.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/shared/backend/streak.test.ts`
Expected: PASS (구현이 이미 존재하므로 통과해야 정상). 만약 FAIL이면 A2 구현 점검.

- [ ] **Step 3: 커밋**

```bash
git add src/features/shared/backend/streak.test.ts
git commit -m "test(streak): 자동 휴원 감지·스트릭 계산 단위 테스트 추가"
```

---

### Task A4: attendance-board 서비스를 공유 모듈로 리팩토링

**Files:**
- Modify: `src/features/attendance-board/backend/service.ts`
- Modify: `src/features/attendance-board/backend/schema.ts`

- [ ] **Step 1: schema.ts에서 StreakTier 재노출로 변경**

`src/features/attendance-board/backend/schema.ts`의 9~10행:
```typescript
/** 스트릭 등급 */
export type StreakTier = 'none' | 'fire' | 'lightning' | 'diamond' | 'crown' | 'myth';
```
을 다음으로 교체:
```typescript
/** 스트릭 등급 (단일 출처 재노출) */
export type { StreakTier } from '@/features/shared/lib/streak-tier';
```

- [ ] **Step 2: service.ts에서 인라인 스트릭 로직 제거 및 공유 모듈 사용**

`service.ts` 상단 import에서 다음을 제거: `getStreakTier` 로컬 함수(24~32행), `isScheduledOnDate`(34~52행), `calculateConsecutiveAttendance`(54~111행), `calculateConsecutiveConsultation`(113~171행) 4개 함수 정의 전체 삭제.

import 블록(1~16행)을 다음과 같이 정리(불필요해진 `fetchAllPaginated`, `getHolidayDatesMap`, `isWeekend`는 이 파일에서 더 안 쓰면 제거):
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  GetAttendanceBoardParams,
  BoardPatient,
  RoomGroup,
  AttendanceBoardResponse,
  AttendanceStatus,
} from './schema';
import { AttendanceBoardError, AttendanceBoardErrorCode } from './error';
import { getTodayString } from '@/lib/date';
import { ensureScheduleGenerated } from '@/server/services/schedule';
import { getStreaksMap, type PatientStreaks } from '@/features/shared/backend/streak';
import { getStreakTier } from '@/features/shared/lib/streak-tier';
```

`getAttendanceBoard` 본문에서 60일 윈도우 fetch 5개(`allAttendances`/`allConsultations`/`allScheduled`/`allPatterns`/`holidayMap`)와 그에 따른 환자별 맵 구축 루프(279~309행)를 제거한다. `Promise.all`에는 오늘자 5개 쿼리(patients/attendances/scheduled/consultations/roomMappings)만 남긴다. `streakStartDate` 변수(181~182행)도 제거.

patients fetch 직후에 스트릭 맵을 계산:
```typescript
  const streaksMap: Map<string, PatientStreaks> = await getStreaksMap(
    supabase,
    date,
    (patients ?? []).map((p) => ({ id: p.id, created_at: p.created_at })),
  );
```

환자 루프(330행~) 내 스트릭 계산부(346~358행)를 교체:
```typescript
    const raw = streaksMap.get(patient.id) ?? { attendance_streak: 0, consultation_streak: 0, streak_tier: 'none' as const };
    const attendanceStreak = isNotScheduled ? 0 : raw.attendance_streak;
    const consultationStreak = isNotScheduled ? 0 : raw.consultation_streak;
```
그리고 `boardPatient`의 `streak_tier`는 `getStreakTier(attendanceStreak)` 유지(이미 import됨).

기존에 쓰던 `patientCreatedDate`, `pScheduled` 등 환자별 지역 변수(346~351행)는 제거.

- [ ] **Step 3: 타입체크 + 출석보드 회귀 테스트**

Run: `npx tsc --noEmit`
Expected: 오류 없음 (미사용 import 경고 없음)

Run: `npx vitest run src/features/shared/backend/streak.test.ts`
Expected: PASS

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 성공

- [ ] **Step 5: 커밋**

```bash
git add src/features/attendance-board/backend/service.ts src/features/attendance-board/backend/schema.ts
git commit -m "refactor(attendance-board): 스트릭 계산을 공유 모듈로 이전"
```

---

### Task A5: 2026 공휴일 시드 마이그레이션

**Files:**
- Create: `supabase/migrations/20260608000000_seed_holidays_2026.sql` (실제 prefix는 기존 파일이 `YYYYMMDDHHMMSS` 타임스탬프 형식이므로 `ls supabase/migrations | sort | tail -1` 확인 후 그보다 큰 값으로 맞출 것)

- [ ] **Step 1: 마이그레이션 작성** (멱등)

```sql
-- 2026년 한국 공휴일 + 확인된 낮병원 휴원일 시드
-- holidays(date UNIQUE, reason) 기준, 재실행 안전
INSERT INTO holidays (date, reason) VALUES
  ('2026-01-01', '신정'),
  ('2026-02-16', '설날 연휴'),
  ('2026-02-17', '설날'),
  ('2026-02-18', '설날 연휴'),
  ('2026-03-01', '삼일절'),
  ('2026-03-02', '삼일절 대체휴일'),
  ('2026-05-01', '근로자의 날'),
  ('2026-05-05', '어린이날'),
  ('2026-05-24', '부처님오신날'),
  ('2026-05-25', '부처님오신날 대체휴일'),
  ('2026-06-03', '제8회 전국동시지방선거'),
  ('2026-06-06', '현충일'),
  ('2026-08-15', '광복절'),
  ('2026-08-17', '광복절 대체휴일'),
  ('2026-09-24', '추석 연휴'),
  ('2026-09-25', '추석'),
  ('2026-09-26', '추석 연휴'),
  ('2026-10-03', '개천절'),
  ('2026-10-05', '개천절 대체휴일'),
  ('2026-10-09', '한글날'),
  ('2026-12-25', '성탄절')
ON CONFLICT (date) DO NOTHING;
```

- [ ] **Step 2: 사용자에게 적용 요청**

이 마이그레이션 SQL을 사용자에게 보여주고 Supabase에 직접 적용하도록 안내한다(프로젝트 규칙: 로컬 적용 금지). 자동 휴원 감지(A2)가 이미 과거 휴원을 커버하므로 적용 전에도 스트릭은 정상 동작하지만, 미래 공휴일·데이터 없는 날을 위해 적용 권장.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260608000000_seed_holidays_2026.sql
git commit -m "feat(holidays): 2026 공휴일/휴원일 시드 마이그레이션 추가"
```

---

# PART B — 직역 대시보드 스트릭 뱃지

### Task B1: 공용 StreakBadge 컴포넌트 + StreakEffect 중복 제거

**Files:**
- Create: `src/features/shared/components/StreakBadge.tsx`
- Modify: `src/features/attendance-board/components/StreakEffect.tsx`

- [ ] **Step 1: StreakBadge 작성**

```typescript
'use client';

import { getStreakTier, STREAK_TIER_META, STREAK_BADGE_MIN } from '@/features/shared/lib/streak-tier';

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

/**
 * 목록용 압축 스트릭 뱃지. streak < 3 이면 렌더링하지 않음.
 * 예: 🔥3, ⚡7, 💎12
 */
export function StreakBadge({ streak, className }: StreakBadgeProps) {
  if (streak < STREAK_BADGE_MIN) return null;
  const tier = getStreakTier(streak);
  if (tier === 'none') return null;
  const meta = STREAK_TIER_META[tier];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 4px',
        borderRadius: 9999,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.text,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
      }}
      aria-label={`${streak}일 연속 출석`}
      title={`${streak}일 연속 출석 ${meta.label}`}
    >
      {meta.icon}{streak}
    </span>
  );
}
```

- [ ] **Step 2: StreakEffect 중복 제거** — `StreakEffect.tsx` 내부의 로컬 `BADGE_COLORS`(142~148행)와 `PARTICLE_CONFIG` 아이콘을 공유 메타로 대체한다. 로컬 `StreakBadge` 함수(120~140행)의 색상/아이콘 참조를 다음으로 변경:

상단 import 추가:
```typescript
import { STREAK_TIER_META } from '@/features/shared/lib/streak-tier';
```
로컬 `StreakBadge`(120~140행)에서 `const colors = BADGE_COLORS[tier];`를 `const colors = tier === 'none' ? undefined : STREAK_TIER_META[tier];`로 바꾸고, `BADGE_COLORS` 상수 정의(142~148행)는 삭제. (`colors.bg/border/text/icon` 사용부는 그대로 동작 — 메타 키가 동일함.)

- [ ] **Step 3: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공, 출석보드 시각 동작 동일

- [ ] **Step 4: 커밋**

```bash
git add src/features/shared/components/StreakBadge.tsx src/features/attendance-board/components/StreakEffect.tsx
git commit -m "feat(streak): 목록용 StreakBadge 추가 및 등급 메타 단일화"
```

---

### Task B2: 스트릭 배치 엔드포인트 + 훅

**Files:**
- Create: `src/features/attendance-board/backend/streaks-schema.ts`
- Modify: `src/features/attendance-board/backend/service.ts`
- Modify: `src/features/attendance-board/backend/route.ts`
- Create: `src/features/attendance-board/hooks/streak-keys.ts`
- Create: `src/features/attendance-board/hooks/useStreaks.ts`

- [ ] **Step 1: streaks-schema.ts 작성**

```typescript
import type { PatientStreaks } from '@/features/shared/backend/streak';

export type StreaksResponse = {
  date: string;
  streaks: Record<string, PatientStreaks>;
};
```

- [ ] **Step 2: service.ts에 getStreaksForActivePatients 추가** (파일 하단에 append)

```typescript
import type { StreaksResponse } from './streaks-schema';

/**
 * 전 활성 환자의 raw 스트릭 맵을 반환 (대시보드 뱃지용).
 * 출석보드와 달리 not_scheduled 보정 없이 실제 연속일수를 그대로 노출.
 */
export async function getStreaksForActivePatients(
  supabase: SupabaseClient<Database>,
  date: string,
): Promise<StreaksResponse> {
  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, created_at')
    .eq('status', 'active');

  if (error) {
    throw new AttendanceBoardError(
      AttendanceBoardErrorCode.FETCH_FAILED,
      `스트릭 환자 조회 실패: ${error.message}`,
    );
  }

  const map = await getStreaksMap(
    supabase,
    date,
    (patients ?? []).map((p) => ({ id: p.id, created_at: p.created_at })),
  );

  const streaks: StreaksResponse['streaks'] = {};
  for (const [id, s] of map) streaks[id] = s;
  return { date, streaks };
}
```

- [ ] **Step 3: route.ts에 GET /streaks 추가** — `attendance-board/backend/route.ts`의 `export default` 앞에 추가, import에 `getStreaksForActivePatients`, `getTodayString` 보강:

```typescript
import { getAttendanceBoard, getStreaksForActivePatients } from './service';
import { getTodayString } from '@/lib/date';
```
```typescript
/**
 * GET /api/shared/attendance-board/streaks
 * 전 활성 환자 연속 출석/진찰 스트릭 맵
 */
attendanceBoardRoutes.get('/streaks', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }
  const date = c.req.query('date') || getTodayString();
  try {
    const result = await getStreaksForActivePatients(supabase, date);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AttendanceBoardError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});
```
주의: Hono는 `/streaks`를 `/`보다 먼저 또는 정확 매칭으로 처리하므로 등록 순서 무관하나, 명시적으로 `/streaks`를 `get('/')` 위에 둔다.

- [ ] **Step 4: streak-keys.ts + useStreaks.ts 작성**

`streak-keys.ts`:
```typescript
export const streakKeys = {
  all: ['streaks'] as const,
  byDate: (date: string) => ['streaks', date] as const,
};
```

`useStreaks.ts`:
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { streakKeys } from './streak-keys';
import type { StreaksResponse } from '../backend/streaks-schema';

const STALE_TIME_MS = 60_000;

export const useStreaks = (date?: string) => {
  return useQuery<StreaksResponse>({
    queryKey: streakKeys.byDate(date ?? ''),
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const query = date ? `?date=${date}` : '';
      const { data } = await apiClient.get<StreaksResponse>(
        `/api/shared/attendance-board/streaks${query}`,
      );
      return data;
    },
  });
};
```

- [ ] **Step 5: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공

- [ ] **Step 6: 커밋**

```bash
git add src/features/attendance-board/backend/streaks-schema.ts src/features/attendance-board/backend/service.ts src/features/attendance-board/backend/route.ts src/features/attendance-board/hooks/streak-keys.ts src/features/attendance-board/hooks/useStreaks.ts
git commit -m "feat(streak): 전 환자 스트릭 배치 엔드포인트와 useStreaks 훅 추가"
```

---

### Task B3: 의사 대시보드 환자 목록에 뱃지

**Files:**
- Modify: `src/features/doctor/components/PatientListPanel.tsx`

- [ ] **Step 1: 훅 연결 및 뱃지 렌더** — 컴포넌트 상단에서 `useStreaks`를 호출하고, 각 환자 카드의 이름 옆에 `StreakBadge`를 추가한다.

import 추가:
```typescript
import { useStreaks } from '@/features/attendance-board/hooks/useStreaks';
import { StreakBadge } from '@/features/shared/components/StreakBadge';
```
컴포넌트 함수 본문 상단(다른 훅 호출부 근처):
```typescript
  const { data: streaksData } = useStreaks();
```
환자 카드의 이름이 렌더되는 위치(환자 `name`/`display_name` 표시 span 직후)에 삽입:
```typescript
  <StreakBadge streak={streaksData?.streaks?.[patient.id]?.attendance_streak ?? 0} className="ml-1 align-middle" />
```
(정확한 삽입 지점은 파일에서 환자 이름 렌더 부분 — `getPatientDisplayName(patient)` 또는 `patient.name` 출력부 — 을 찾아 그 옆에 둔다. `patient.id`가 카드 맵 콜백의 환자 식별자임을 확인.)

- [ ] **Step 2: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add src/features/doctor/components/PatientListPanel.tsx
git commit -m "feat(doctor): 환자 목록에 연속출석 뱃지 표시"
```

---

### Task B4: 간호사·코디·관리자 대시보드 환자 목록에 뱃지

**Files:**
- Modify: `src/features/nurse/components/NursePatientListPanel.tsx`
- Modify: `src/features/staff/components/StaffPatientListPanel.tsx`
- Modify: `src/features/admin/components/AdminPatientListPanel.tsx`

- [ ] **Step 1: 세 파일 각각에 B3와 동일 패턴 적용** — 각 파일에 동일 import 2줄, `const { data: streaksData } = useStreaks();` 호출, 환자 이름 렌더부 옆에 동일 `StreakBadge` 삽입. 각 패널의 환자 식별자 필드가 `patient.id`임을 확인하고, staff 패널의 "출석/진찰 체크 모드"에서는 일반 모드 카드(아바타 표시 시)에만 뱃지를 둔다(체크박스 모드 레이아웃은 그대로).

```typescript
import { useStreaks } from '@/features/attendance-board/hooks/useStreaks';
import { StreakBadge } from '@/features/shared/components/StreakBadge';
```
```typescript
const { data: streaksData } = useStreaks();
```
```typescript
<StreakBadge streak={streaksData?.streaks?.[patient.id]?.attendance_streak ?? 0} className="ml-1 align-middle" />
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add src/features/nurse/components/NursePatientListPanel.tsx src/features/staff/components/StaffPatientListPanel.tsx src/features/admin/components/AdminPatientListPanel.tsx
git commit -m "feat(dashboard): 간호사·코디·관리자 목록에 연속출석 뱃지 표시"
```

---

# PART C — 주사제 이력 의사화면

### Task C1: Carescheduler 이력 엔드포인트 추가

**Files:**
- Create: `/Users/seunghyun/Carescheduler/src/app/api/external/injections/history/route.ts`

> 작업 디렉토리: `/Users/seunghyun/Carescheduler` (별도 git 저장소). 커밋도 그곳에서 수행.

- [ ] **Step 1: 엔드포인트 작성** — 기존 `injections/route.ts`의 인증/환자조회 패턴을 따른다. injection 카테고리 schedule 전체(상태 무관)를 조회하고, `schedule_executions`의 completed 건을 약품명 기준으로 묶어 회차를 부여한다.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAYCARE_DEPARTMENT_NAME = '낮병원';
const INJECTION_CATEGORY = 'injection';
const ACTIVE_SCHEDULE_STATUS = 'active';
const COMPLETED_STATUS = 'completed';

const querySchema = z.object({ patient_number: z.string().min(1).max(64) });

function unauthorized(message = 'Invalid API key') {
  return NextResponse.json({ error: 'UNAUTHORIZED', message }, { status: 401 });
}

type ExecutionRow = { executed_date: string | null; planned_date: string | null; status: string };
type ScheduleRow = {
  status: string;
  interval_weeks: number;
  next_due_date: string;
  items: { name: string; category: string } | null;
  schedule_executions: ExecutionRow[] | null;
};

export type InjectionHistoryEntry = { dose_seq: number; executed_date: string; planned_date: string | null };
export type InjectionHistoryItem = {
  item_name: string;
  interval_weeks: number;
  next_due_date: string | null;
  total_doses: number;
  history: InjectionHistoryEntry[];
};

/** 순수 변환: schedule rows → item별 이력(회차 부여). 테스트 대상. */
export function buildInjectionHistory(rows: ScheduleRow[]): InjectionHistoryItem[] {
  type Acc = { interval_weeks: number; next_due_date: string | null; executed: { executed_date: string; planned_date: string | null }[] };
  const byItem = new Map<string, Acc>();

  for (const row of rows) {
    if (!row.items) continue;
    const key = row.items.name;
    const acc = byItem.get(key) ?? { interval_weeks: row.interval_weeks, next_due_date: null, executed: [] };
    // next_due_date는 active schedule에서만 채움
    if (row.status === ACTIVE_SCHEDULE_STATUS) {
      acc.next_due_date = row.next_due_date;
      acc.interval_weeks = row.interval_weeks;
    }
    for (const ex of row.schedule_executions ?? []) {
      if (ex.status === COMPLETED_STATUS && ex.executed_date) {
        acc.executed.push({ executed_date: ex.executed_date, planned_date: ex.planned_date });
      }
    }
    byItem.set(key, acc);
  }

  const items: InjectionHistoryItem[] = [];
  for (const [item_name, acc] of byItem) {
    const sortedAsc = [...acc.executed].sort((a, b) => a.executed_date.localeCompare(b.executed_date));
    const withSeq = sortedAsc.map((e, i) => ({ dose_seq: i + 1, executed_date: e.executed_date, planned_date: e.planned_date }));
    // 응답은 최신순
    const history = [...withSeq].reverse();
    items.push({
      item_name,
      interval_weeks: acc.interval_weeks,
      next_due_date: acc.next_due_date,
      total_doses: withSeq.length,
      history,
    });
  }
  // 다음 예정일 가까운 순 → null은 뒤로
  items.sort((a, b) => {
    if (a.next_due_date && b.next_due_date) return a.next_due_date.localeCompare(b.next_due_date);
    if (a.next_due_date) return -1;
    if (b.next_due_date) return 1;
    return a.item_name.localeCompare(b.item_name);
  });
  return items;
}

export async function GET(request: NextRequest) {
  const expectedKey = process.env.DAYCARE_API_KEY;
  if (!expectedKey) {
    logger.error({ endpoint: '/api/external/injections/history' }, 'DAYCARE_API_KEY is not configured');
    return NextResponse.json({ error: 'SERVER_MISCONFIGURED', message: 'External integration not configured' }, { status: 500 });
  }
  const providedKey = request.headers.get('x-daycare-api-key');
  if (!providedKey || providedKey !== expectedKey) return unauthorized();

  const parsed = querySchema.safeParse({ patient_number: request.nextUrl.searchParams.get('patient_number') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_QUERY', issues: parsed.error.issues }, { status: 400 });
  }
  const { patient_number } = parsed.data;

  try {
    const supabase = await createServiceClient();
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select(`id, patient_number, name, departments!inner ( name )`)
      .eq('patient_number', patient_number)
      .eq('archived', false)
      .eq('is_active', true)
      .eq('departments.name', DAYCARE_DEPARTMENT_NAME)
      .limit(1)
      .maybeSingle();

    if (patientError) {
      logger.error({ error: patientError, patient_number }, 'Failed to look up patient');
      return NextResponse.json({ error: 'DB_ERROR', message: patientError.message }, { status: 500 });
    }
    if (!patient) {
      return NextResponse.json({ patient_number, patient_name: null, injections: [] });
    }
    const patientRow = patient as unknown as { id: string; name: string };

    const { data: schedules, error: schedError } = await supabase
      .from('schedules')
      .select(`
        status, interval_weeks, next_due_date,
        items!inner ( name, category ),
        schedule_executions ( executed_date, planned_date, status )
      `)
      .eq('patient_id', patientRow.id)
      .eq('items.category', INJECTION_CATEGORY);

    if (schedError) {
      logger.error({ error: schedError, patient_number }, 'Failed to fetch injection history');
      return NextResponse.json({ error: 'DB_ERROR', message: schedError.message }, { status: 500 });
    }

    const injections = buildInjectionHistory((schedules ?? []) as unknown as ScheduleRow[]);
    return NextResponse.json({ patient_number, patient_name: patientRow.name, injections });
  } catch (err) {
    logger.error({ err, patient_number }, 'Unexpected error in injection history endpoint');
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 순수 변환 테스트(있으면)** — Carescheduler에 vitest가 있으면(`cd /Users/seunghyun/Carescheduler && grep -q vitest package.json && echo yes`) `history/route.test.ts`에 `buildInjectionHistory` 테스트 작성:

```typescript
import { describe, it, expect } from 'vitest';
import { buildInjectionHistory } from './route';

describe('buildInjectionHistory', () => {
  it('완료 건만 약품별로 묶어 오름차순 회차를 부여하고 최신순으로 반환한다', () => {
    const rows = [{
      status: 'active', interval_weeks: 12, next_due_date: '2026-08-20',
      items: { name: '인베가 트린자', category: 'injection' },
      schedule_executions: [
        { executed_date: '2026-05-28', planned_date: '2026-05-28', status: 'completed' },
        { executed_date: '2025-09-18', planned_date: '2025-09-18', status: 'completed' },
        { executed_date: null, planned_date: '2026-08-20', status: 'planned' },
      ],
    }];
    const [item] = buildInjectionHistory(rows as never);
    expect(item.total_doses).toBe(2);
    expect(item.next_due_date).toBe('2026-08-20');
    expect(item.history[0]).toEqual({ dose_seq: 2, executed_date: '2026-05-28', planned_date: '2026-05-28' });
    expect(item.history[1].dose_seq).toBe(1);
  });
});
```
Run: `cd /Users/seunghyun/Carescheduler && npx vitest run src/app/api/external/injections/history/route.test.ts`
Expected: PASS. (vitest 없으면 이 스텝 생략하고 다음으로.)

- [ ] **Step 3: Carescheduler 타입체크/빌드 + 커밋**

Run: `cd /Users/seunghyun/Carescheduler && npx tsc --noEmit`
Expected: 신규 파일 오류 없음
```bash
cd /Users/seunghyun/Carescheduler
git add src/app/api/external/injections/history/
git commit -m "feat(external): 낮병원 주사제 투여 이력(회차) 엔드포인트 추가"
```

---

### Task C2: Daycare 통합 클라이언트/스키마

**Files:**
- Modify: `src/server/integrations/carescheduler/schema.ts`
- Modify: `src/server/integrations/carescheduler/client.ts`

- [ ] **Step 1: schema.ts에 이력 스키마 추가** (파일 하단 append)

```typescript
export const CareschedulerInjectionHistoryEntrySchema = z.object({
  dose_seq: z.number().int().positive(),
  executed_date: z.string(),
  planned_date: z.string().nullable(),
});

export const CareschedulerInjectionHistoryItemSchema = z.object({
  item_name: z.string(),
  interval_weeks: z.number().int().positive(),
  next_due_date: z.string().nullable(),
  total_doses: z.number().int().nonnegative(),
  history: z.array(CareschedulerInjectionHistoryEntrySchema),
});

export const CareschedulerInjectionHistoryResponseSchema = z.object({
  patient_number: z.string(),
  patient_name: z.string().nullable(),
  injections: z.array(CareschedulerInjectionHistoryItemSchema),
});

export type CareschedulerInjectionHistoryResponse = z.infer<
  typeof CareschedulerInjectionHistoryResponseSchema
>;
```

- [ ] **Step 2: client.ts에 fetch 함수 추가** — 상단 import에 신규 스키마/타입 추가, 상수에 경로 추가, 함수 append. 기존 `fetchInjectionsByPatientNumber` 구조를 그대로 복제하되 경로/스키마만 교체.

import 보강:
```typescript
import {
  CareschedulerInjectionsResponseSchema,
  CareschedulerUpcomingResponseSchema,
  CareschedulerInjectionHistoryResponseSchema,
  type CareschedulerInjectionsResponse,
  type CareschedulerUpcomingResponse,
  type CareschedulerInjectionHistoryResponse,
} from './schema';
```
상수:
```typescript
const HISTORY_PATH = '/api/external/injections/history';
```
함수 + 결과 타입:
```typescript
export type FetchInjectionHistoryResult =
  | { ok: true; data: CareschedulerInjectionHistoryResponse }
  | FetchFailure;

export async function fetchInjectionHistoryByPatientNumber(
  patientNumber: string,
): Promise<FetchInjectionHistoryResult> {
  const { carescheduler } = getAppConfig();
  const url = new URL(HISTORY_PATH, carescheduler.apiUrl);
  url.searchParams.set('patient_number', patientNumber);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { [API_KEY_HEADER]: carescheduler.apiKey, Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 401) return { ok: false, reason: 'unauthorized' };
    if (!response.ok) return { ok: false, reason: 'bad_response', detail: `HTTP ${response.status}` };
    const body = (await response.json()) as unknown;
    const parsed = CareschedulerInjectionHistoryResponseSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, reason: 'bad_response', detail: parsed.error.issues.map((i) => i.message).join('; ') };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'network', detail: err instanceof Error ? err.message : 'unknown network error' };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add src/server/integrations/carescheduler/schema.ts src/server/integrations/carescheduler/client.ts
git commit -m "feat(carescheduler): 주사제 이력 조회 클라이언트 추가"
```

---

### Task C3: Daycare BFF (이력 서비스/라우트/스키마/dto)

**Files:**
- Modify: `src/features/injections/backend/schema.ts`
- Modify: `src/features/injections/backend/service.ts`
- Modify: `src/features/injections/backend/route.ts`
- Modify: `src/features/injections/lib/dto.ts`

- [ ] **Step 1: backend/schema.ts에 BFF 이력 스키마 추가** (하단 append)

```typescript
export const InjectionHistoryEntrySchema = z.object({
  dose_seq: z.number().int().positive(),
  executed_date: z.string(),
  planned_date: z.string().nullable(),
});

export const InjectionHistoryItemSchema = z.object({
  item_name: z.string(),
  interval_weeks: z.number().int().positive(),
  next_due_date: z.string().nullable(),
  total_doses: z.number().int().nonnegative(),
  history: z.array(InjectionHistoryEntrySchema),
});

export const PatientInjectionHistoryResponseSchema = z.object({
  patient_id: z.string().uuid(),
  patient_id_no: z.string(),
  patient_name: z.string().nullable(),
  injections: z.array(InjectionHistoryItemSchema),
  upstream_available: z.boolean(),
});

export type InjectionHistoryItem = z.infer<typeof InjectionHistoryItemSchema>;
export type PatientInjectionHistoryResponse = z.infer<typeof PatientInjectionHistoryResponseSchema>;
```

- [ ] **Step 2: service.ts에 getPatientInjectionHistory 추가** — `fetchInjectionHistoryByPatientNumber` import 추가 후, `getPatientInjections`와 동일한 환자 매핑/폴백 구조로 작성.

import 교체:
```typescript
import {
  fetchInjectionsByPatientNumber,
  fetchUpcomingInjections,
  fetchInjectionHistoryByPatientNumber,
} from '@/server/integrations/carescheduler/client';
import type { PatientInjectionsResponse, UpcomingInjectionsResponse, PatientInjectionHistoryResponse } from './schema';
```
함수 append:
```typescript
export async function getPatientInjectionHistory(
  supabase: DB,
  patientId: string,
): Promise<PatientInjectionHistoryResponse> {
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, patient_id_no')
    .eq('id', patientId)
    .maybeSingle();

  if (patientError) {
    throw new InjectionsError(InjectionsErrorCode.PATIENT_NOT_FOUND, `환자 조회 실패: ${patientError.message}`);
  }
  if (!patient) {
    throw new InjectionsError(InjectionsErrorCode.PATIENT_NOT_FOUND, '환자를 찾을 수 없습니다.');
  }
  const patientRow = patient as { id: string; patient_id_no: string | null };
  if (!patientRow.patient_id_no) {
    throw new InjectionsError(InjectionsErrorCode.MISSING_PATIENT_ID_NO, '환자에게 병록번호(IDNO)가 등록되어 있지 않습니다.');
  }

  const result = await fetchInjectionHistoryByPatientNumber(patientRow.patient_id_no);
  if (!result.ok) {
    return {
      patient_id: patientRow.id,
      patient_id_no: patientRow.patient_id_no,
      patient_name: null,
      injections: [],
      upstream_available: false,
    };
  }
  return {
    patient_id: patientRow.id,
    patient_id_no: patientRow.patient_id_no,
    patient_name: result.data.patient_name,
    injections: result.data.injections,
    upstream_available: true,
  };
}
```

- [ ] **Step 3: route.ts에 GET /patient/:patientId/history 추가** — `getPatientInjectionHistory` import 보강 후 `/patient/:patientId` 라우트 아래에 추가:

```typescript
injectionsRoutes.get('/patient/:patientId/history', async (c) => {
  const supabase = c.get('supabase');
  const parsed = patientIdSchema.safeParse(c.req.param('patientId'));
  if (!parsed.success) {
    return respond(c, failure(400, InjectionsErrorCode.INVALID_REQUEST, parsed.error.issues[0]?.message ?? '잘못된 요청입니다.'));
  }
  try {
    const result = await getPatientInjectionHistory(supabase, parsed.data);
    return respond(c, success(result, 200));
  } catch (err) {
    if (err instanceof InjectionsError) {
      const status = err.code === InjectionsErrorCode.PATIENT_NOT_FOUND ? 404 : 400;
      return respond(c, failure(status, err.code, err.message));
    }
    throw err;
  }
});
```
import 라인 교체: `import { getPatientInjections, getUpcomingInjections, getPatientInjectionHistory } from './service';`

- [ ] **Step 4: dto.ts에 이력 타입 재노출**

```typescript
export {
  PatientInjectionSchema,
  PatientInjectionsResponseSchema,
  UpcomingInjectionItemSchema,
  UpcomingInjectionsResponseSchema,
  InjectionHistoryEntrySchema,
  InjectionHistoryItemSchema,
  PatientInjectionHistoryResponseSchema,
  type PatientInjection,
  type PatientInjectionsResponse,
  type UpcomingInjectionItem,
  type UpcomingInjectionsResponse,
  type InjectionHistoryItem,
  type PatientInjectionHistoryResponse,
} from '../backend/schema';
```

- [ ] **Step 5: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공

- [ ] **Step 6: 커밋**

```bash
git add src/features/injections/backend/schema.ts src/features/injections/backend/service.ts src/features/injections/backend/route.ts src/features/injections/lib/dto.ts
git commit -m "feat(injections): 환자별 주사 이력 BFF 엔드포인트 추가"
```

---

### Task C4: 이력 훅 + 카드 컴포넌트 + 의사 진료 패널 삽입

**Files:**
- Modify: `src/features/injections/hooks/query-keys.ts`
- Create: `src/features/injections/hooks/usePatientInjectionHistory.ts`
- Create: `src/features/injections/components/PatientInjectionHistoryCard.tsx`
- Modify: `src/features/doctor/components/ConsultationPanel.tsx`

- [ ] **Step 1: query-keys.ts에 history 키 추가** — `patient` 객체에 추가:

```typescript
  patient: {
    all: ['injections', 'patient'] as const,
    detail: (patientId: string) => ['injections', 'patient', patientId] as const,
    history: (patientId: string) => ['injections', 'patient', patientId, 'history'] as const,
  },
```

- [ ] **Step 2: usePatientInjectionHistory.ts 작성**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { injectionsKeys } from './query-keys';
import type { PatientInjectionHistoryResponse } from '../lib/dto';

const STALE_TIME_MS = 10 * 60 * 1000;

export const usePatientInjectionHistory = (patientId: string | null | undefined) => {
  return useQuery<PatientInjectionHistoryResponse>({
    queryKey: injectionsKeys.patient.history(patientId ?? ''),
    enabled: Boolean(patientId),
    staleTime: STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await apiClient.get<PatientInjectionHistoryResponse>(
        `/api/shared/injections/patient/${patientId}/history`,
      );
      return data;
    },
  });
};
```

- [ ] **Step 3: PatientInjectionHistoryCard.tsx 작성** — `PatientInjectionsCard`의 D-day 헬퍼 패턴을 재사용하되 회차/이력 표시.

```typescript
'use client';

import { useState } from 'react';
import { Syringe, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePatientInjectionHistory } from '../hooks/usePatientInjectionHistory';
import type { InjectionHistoryItem } from '../lib/dto';

const URGENCY_DAYS = 7;
const COLLAPSED_COUNT = 3;

type Props = { patientId: string; className?: string };

function formatDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return format(parsed, 'yyyy-MM-dd (EEE)', { locale: ko });
}

function daysUntil(dateStr: string): number | null {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function dueBadge(dateStr: string | null) {
  if (!dateStr) return <Badge variant="secondary">예정 없음</Badge>;
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">지남 {Math.abs(days)}일</Badge>;
  if (days === 0) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">오늘</Badge>;
  if (days <= URGENCY_DAYS) return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">D-{days}</Badge>;
  return <Badge variant="secondary">D-{days}</Badge>;
}

function HistoryItemBlock({ item }: { item: InjectionHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? item.history : item.history.slice(0, COLLAPSED_COUNT);
  const hasMore = item.history.length > COLLAPSED_COUNT;

  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{item.item_name}</span>
          <span className="text-xs text-gray-500 whitespace-nowrap">총 {item.total_doses}회차</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-xs text-gray-500">다음: {item.next_due_date ? formatDate(item.next_due_date) : '-'}</span>
          {dueBadge(item.next_due_date)}
        </div>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {visible.map((h) => (
          <li key={`${item.item_name}-${h.dose_seq}`} className="text-xs text-gray-600 flex items-center gap-2">
            <span className="inline-flex items-center justify-center min-w-[2.2rem] px-1 rounded bg-purple-50 text-purple-700 font-semibold">{h.dose_seq}차</span>
            <span>{formatDate(h.executed_date)}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-purple-600 inline-flex items-center gap-0.5"
        >
          {expanded ? (<><ChevronUp className="w-3 h-3" /> 접기</>) : (<><ChevronDown className="w-3 h-3" /> 이력 {item.history.length}건 전체보기</>)}
        </button>
      )}
    </div>
  );
}

export function PatientInjectionHistoryCard({ patientId, className }: Props) {
  const { data, isLoading, isError } = usePatientInjectionHistory(patientId);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Syringe className="w-4 h-4 text-purple-600" />
          주사제 이력
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : isError || !data ? (
          <p className="text-sm text-gray-400">주사제 정보를 불러오지 못했습니다.</p>
        ) : !data.upstream_available ? (
          <p className="text-sm text-gray-400">Carescheduler 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>
        ) : data.injections.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 장기지속형 주사제 이력이 없습니다.</p>
        ) : (
          <div className="divide-y">
            {data.injections.map((item) => (
              <HistoryItemBlock key={item.item_name} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: ConsultationPanel에 카드 삽입** — `ConsultationPanel.tsx`의 `AttendanceCalendar`(330행 부근, 선택 환자 영역) 바로 아래에 카드를 둔다.

import 추가:
```typescript
import { PatientInjectionHistoryCard } from '@/features/injections/components/PatientInjectionHistoryCard';
```
`<AttendanceCalendar patientId={patient.id} birthDate={patient.birth_date} />` 다음 줄에 추가:
```typescript
          <PatientInjectionHistoryCard patientId={patient.id} className="mt-4" />
```

- [ ] **Step 5: 타입체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공

- [ ] **Step 6: 커밋**

```bash
git add src/features/injections/hooks/query-keys.ts src/features/injections/hooks/usePatientInjectionHistory.ts src/features/injections/components/PatientInjectionHistoryCard.tsx src/features/doctor/components/ConsultationPanel.tsx
git commit -m "feat(doctor): 진료 패널에 주사제 이력(회차) 카드 추가"
```

---

## 최종 검증 (전체 통합)

- [ ] **Step 1: 전체 품질 게이트**

Run: `npx tsc --noEmit && npx eslint . --max-warnings=0 && npm run build && npx vitest run`
Expected: 모두 통과

- [ ] **Step 2: 수동 확인 (개발 서버)**
- 출석보드: 매일 출석 환자의 스트릭이 06-03을 건너뛰어 두 자릿수로 표시.
- 4개 대시보드(의사/간호사/코디/관리자): 환자 목록에 🔥/💎 뱃지(streak≥3).
- 의사 진료 패널: 환자 선택 시 "주사제 이력" 카드에 약품·회차·날짜·다음 예정일 표시.

- [ ] **Step 3: Carescheduler 배포 안내** — 이력 엔드포인트는 Carescheduler를 배포해야 운영에서 동작한다(로컬 dev URL이 아니면). 사용자에게 Carescheduler 배포 필요 여부 안내.

---

## 비고
- Carescheduler 미배포 시 Daycare는 `upstream_available: false`로 graceful degradation(카드에 "연결 실패" 문구). 기능 회귀 없음.
- 스트릭 엔드포인트는 전 환자 60일 윈도우를 매 요청 계산하므로 출석보드와 동일 부하. 각 대시보드는 `staleTime 60초` + `refetchOnWindowFocus:false`로 호출 빈도 제한.

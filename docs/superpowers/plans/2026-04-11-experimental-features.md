# 실험적 기능 4종 구현 플랜 (히트맵 / 하이라이트 카드 / 타임라인 / 생일)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 낮병원 앱에 실험 기능 4종(출석 히트맵, 오늘의 하이라이트 카드, 환자 타임라인, 환자 생일)을 기존 UI/성능 퇴행 없이 추가한다.

**Architecture:** 기존 `usePatientAttendanceCalendar`와 `absence-risk` 서비스를 최대 재사용한다. 신규 엔드포인트는 2개(`/api/shared/highlights/today`, `/api/shared/patient/:id/timeline`)만 추가한다. 생일은 `patients.birth_date` 컬럼 재도입으로 시작하며, `NULL`인 환자는 기존 UI에 아무 영향이 없다. 각 기능은 독립 섹션으로 추가되어 Phase 단위로 롤백 가능하다.

**Tech Stack:** Next.js(App Router) + Hono + Supabase, React Query, react-hook-form + zod, date-fns, recharts, Tailwind + shadcn-ui, vitest.

**Design Spec:** `docs/superpowers/specs/2026-04-11-experimental-features-design.md`

**핵심 제약(사용자 요구):**
- 기존 잘 작동하는 기능을 절대 망가뜨리지 않는다.
- 데이터 로딩 속도를 떨어뜨리지 않는다.

---

## Phase 1 — 생일 기능 (Foundation)

### Task 1: `patients.birth_date` 컬럼 재추가 마이그레이션

**Files:**
- Create: `supabase/migrations/20260411000001_add_patient_birth_date.sql`

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

```sql
-- Migration: patients.birth_date 컬럼 재추가
-- birth_date는 20241202 마이그레이션에서 DROP 되었으나,
-- 생일 알림/표시 기능을 위해 재도입한다.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN patients.birth_date IS '환자 생년월일 (nullable, 수동 입력, 생일 알림/표시용)';
```

- [ ] **Step 2: 사용자에게 Supabase 수동 적용 요청**

README/대화에서 사용자에게 다음을 안내:
"`supabase/migrations/20260411000001_add_patient_birth_date.sql`을 Supabase SQL Editor에서 실행해주세요. 적용 후 `SELECT column_name FROM information_schema.columns WHERE table_name='patients' AND column_name='birth_date';` 로 확인 가능합니다."

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260411000001_add_patient_birth_date.sql
git commit -m "feat(db): patients.birth_date 컬럼 재추가 마이그레이션"
```

---

### Task 2: 생일 유틸리티(`src/lib/birthday.ts`) + TDD

**Files:**
- Create: `src/lib/birthday.ts`
- Create: `src/lib/birthday.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/lib/birthday.test.ts
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
```

- [ ] **Step 2: 테스트 실행(실패 확인)**

Run: `npm test src/lib/birthday.test.ts`
Expected: 모듈 없음 에러 → FAIL

- [ ] **Step 3: 유틸 구현**

```typescript
// src/lib/birthday.ts
import { parseISO, isValid } from 'date-fns';

export function formatBirthDateShort(birthDate: string | null): string {
  if (!birthDate) return '';
  const parsed = parseISO(birthDate);
  if (!isValid(parsed)) return '';
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

export function calculateKoreanAge(
  birthDate: string | null,
  today: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const parsed = parseISO(birthDate);
  if (!isValid(parsed)) return null;

  const birthYear = parsed.getFullYear();
  const birthMonth = parsed.getMonth();
  const birthDay = parsed.getDate();

  let age = today.getFullYear() - birthYear;

  const notReachedThisYear =
    today.getMonth() < birthMonth ||
    (today.getMonth() === birthMonth && today.getDate() < birthDay);

  if (notReachedThisYear) {
    age -= 1;
  }

  return age;
}

export function isBirthdayToday(
  birthDate: string | null,
  today: Date = new Date(),
): boolean {
  if (!birthDate) return false;
  const parsed = parseISO(birthDate);
  if (!isValid(parsed)) return false;

  const birthMonth = parsed.getMonth();
  const birthDay = parsed.getDate();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  if (birthMonth === todayMonth && birthDay === todayDay) return true;

  // 윤년 2/29 생일 → 평년 2/28로 매칭
  if (birthMonth === 1 && birthDay === 29) {
    const isLeap =
      today.getFullYear() % 4 === 0 &&
      (today.getFullYear() % 100 !== 0 || today.getFullYear() % 400 === 0);
    if (!isLeap && todayMonth === 1 && todayDay === 28) return true;
  }

  return false;
}

export function daysUntilNextBirthday(
  birthDate: string | null,
  today: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const parsed = parseISO(birthDate);
  if (!isValid(parsed)) return null;

  const currentYear = today.getFullYear();
  let nextBirthday = new Date(
    currentYear,
    parsed.getMonth(),
    parsed.getDate(),
  );

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (nextBirthday < todayStart) {
    nextBirthday = new Date(currentYear + 1, parsed.getMonth(), parsed.getDate());
  }

  const diffMs = nextBirthday.getTime() - todayStart.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test src/lib/birthday.test.ts`
Expected: all PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/birthday.ts src/lib/birthday.test.ts
git commit -m "feat(lib): 생일 유틸(birthday.ts) 추가 및 테스트"
```

---

### Task 3: Patient select에 `birth_date` 컬럼 추가 (4개 서비스)

**Files:**
- Modify: `src/features/nurse/backend/service.ts` (select문)
- Modify: `src/features/nurse/backend/schema.ts` (NursePatientSummary 등)
- Modify: `src/features/staff/backend/service.ts`
- Modify: `src/features/staff/backend/schema.ts`
- Modify: `src/features/doctor/backend/service.ts`
- Modify: `src/features/doctor/backend/schema.ts`
- Modify: `src/features/admin/backend/service.ts`
- Modify: `src/features/admin/backend/schema.ts`

- [ ] **Step 1: nurse 서비스 select 확장**

`src/features/nurse/backend/service.ts`에서 환자 select 문자열에 `birth_date`를 추가:

```diff
- .select('id, name, display_name, avatar_url, gender, coordinator:staff!patients_coordinator_id_fkey(name)')
+ .select('id, name, display_name, avatar_url, gender, birth_date, coordinator:staff!patients_coordinator_id_fkey(name)')
```

NursePatientSummary(schema.ts)의 zod 스키마에 추가:

```diff
  gender: z.enum(['M', 'F']).nullable(),
+ birth_date: z.string().nullable(),
```

- [ ] **Step 2: staff 서비스 select 확장**

`src/features/staff/backend/service.ts`의 환자 select 문자열:

```diff
- .select('id, name, display_name, avatar_url, gender')
+ .select('id, name, display_name, avatar_url, gender, birth_date')
```

PatientSummary(`src/features/staff/backend/schema.ts`)에도 동일하게 추가:

```diff
  gender: z.enum(['M', 'F']).nullable(),
+ birth_date: z.string().nullable(),
```

- [ ] **Step 3: doctor 서비스 select 확장**

`src/features/doctor/backend/service.ts`의 `patients!inner(...)` 블록:

```diff
  patients!inner(
    id,
    name,
    room_number,
+   birth_date,
    coordinator:coordinator_id(name),
    coordinator_id
  )
```

그리고 PatientBasicInfo 등 스키마에 `birth_date: z.string().nullable()` 추가.

- [ ] **Step 4: admin 서비스 select 확장**

`src/features/admin/backend/service.ts`:

```diff
  .select(`
    id,
    name,
    display_name,
    avatar_url,
    gender,
+   birth_date,
    room_number,
    patient_id_no,
    ...
  `)
```

PatientWithCoordinator(schema.ts)에도:

```diff
  gender: z.enum(['M', 'F']).nullable(),
+ birth_date: z.string().nullable(),
```

그리고 admin update/create schema에서도 허용:

```diff
export const createPatientSchema = z.object({
  ...
+ birth_date: z.string().nullable().optional(),
});
```

- [ ] **Step 5: 타입 체크 + 빌드 검증**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -30`
Expected: PASS (TypeScript errors 0)

- [ ] **Step 6: 커밋**

```bash
git add src/features/nurse src/features/staff src/features/doctor src/features/admin
git commit -m "feat(patient): 환자 서비스 select에 birth_date 컬럼 추가"
```

---

### Task 4: 환자 카드 3종에 생일 표시 추가

**Files:**
- Modify: `src/features/nurse/components/NursePatientCard.tsx`
- Modify: `src/features/staff/components/PatientCard.tsx`
- Modify: `src/features/doctor/components/PatientHistoryCard.tsx`

- [ ] **Step 1: NursePatientCard에 생일 표시 로직 추가**

`NursePatientCard.tsx` 상단 import에:

```typescript
import { Cake } from 'lucide-react';
import { formatBirthDateShort, isBirthdayToday } from '@/lib/birthday';
```

이름(`<h3>`) 옆 또는 아래에 조건부 생일 표시:

```tsx
<div>
  <div className="flex items-center gap-2">
    <h3 className="font-semibold text-gray-900">{patient.name}</h3>
    {patient.birth_date && isBirthdayToday(patient.birth_date) && (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
        <Cake className="w-3 h-3" />
        오늘 생일
      </Badge>
    )}
  </div>
  {patient.birth_date && !isBirthdayToday(patient.birth_date) && (
    <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
      <Cake className="w-2.5 h-2.5" />
      {formatBirthDateShort(patient.birth_date)}
    </p>
  )}
  {patient.attendance_time && (
    <p className="text-xs text-gray-500">
      {format(new Date(patient.attendance_time), 'HH:mm', { locale: ko })} 출석
    </p>
  )}
</div>
```

- [ ] **Step 2: staff PatientCard에도 동일 패턴 적용**

`src/features/staff/components/PatientCard.tsx`에서 `getPatientDisplayName(patient)` 가 렌더되는 `<h3>` 영역에 동일한 분기 추가.

- [ ] **Step 3: doctor PatientHistoryCard에도 추가**

`CardTitle` 내부 `patient.name` 옆에 "오늘 생일" 뱃지, 하단 `grid grid-cols-2 gap-4 text-sm` 블록에 "생년월일" 항목 추가:

```tsx
{patient.birth_date && (
  <div>
    <span className="text-gray-500">생년월일:</span>
    <span className="ml-2 font-medium">
      {patient.birth_date} (만 {calculateKoreanAge(patient.birth_date)}세)
    </span>
  </div>
)}
```

import에 `calculateKoreanAge` 추가.

- [ ] **Step 4: 타입/빌드 검증**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/nurse/components/NursePatientCard.tsx src/features/staff/components/PatientCard.tsx src/features/doctor/components/PatientHistoryCard.tsx
git commit -m "feat(patient-card): 환자 카드 3종에 생일 표시 추가"
```

---

### Task 5: PatientFormModal에 생년월일 필드 추가

**Files:**
- Modify: `src/features/admin/components/PatientFormModal.tsx`

- [ ] **Step 1: zod schema에 birth_date 필드 추가**

```diff
 const patientFormSchema = z.object({
   name: z.string().min(1, '이름을 입력해주세요').max(100),
   gender: z.enum(['M', 'F', '']).optional(),
+  birth_date: z.string().optional(),
   room_number: z.string().max(10).optional(),
   ...
 });
```

- [ ] **Step 2: defaultValues + reset에 birth_date 포함**

`useForm({ defaultValues: { ..., birth_date: '' }})` 와 `reset()` 호출 2군데(edit/create)에 `birth_date: patient?.birth_date || ''` 및 빈 문자열 추가.

- [ ] **Step 3: onSubmit payload에 포함**

```diff
 const payload = {
   name: data.name,
   gender: data.gender === '' ? undefined : data.gender,
+  birth_date: data.birth_date || null,
   room_number: data.room_number || undefined,
   ...
 };
```

- [ ] **Step 4: 폼 JSX에 DatePicker 필드 추가**

성별 필드 다음 위치에 다음 블록 추가:

```tsx
{/* 생년월일 */}
<div className="space-y-2">
  <Label htmlFor="birth_date">생년월일</Label>
  <Input
    id="birth_date"
    type="date"
    {...register('birth_date')}
    disabled={isLoading}
  />
  <p className="text-xs text-gray-400">선택 사항 — 생일 알림/표시에 사용됩니다</p>
</div>
```

- [ ] **Step 5: admin 서비스의 createPatient/updatePatient에서 birth_date 반영**

`src/features/admin/backend/service.ts`의 `createPatient`, `updatePatient` 함수에서 insert/update payload에 `birth_date: input.birth_date ?? null` 추가.

- [ ] **Step 6: 타입/빌드 검증**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/features/admin
git commit -m "feat(admin): 환자 등록/수정 폼에 생년월일 필드 추가"
```

---

### Task 6: AttendanceCalendar에 생일 오버레이 추가

**Files:**
- Modify: `src/features/shared/components/AttendanceCalendar.tsx`

- [ ] **Step 1: props에 birthDate 추가 (optional)**

```diff
 interface AttendanceCalendarProps {
   patientId: string;
+  birthDate?: string | null;
   className?: string;
 }
```

- [ ] **Step 2: 날짜 셀 렌더 로직에 생일 판정 추가**

```diff
+import { Cake } from 'lucide-react';
+import { parseISO } from 'date-fns';

 export function AttendanceCalendar({ patientId, birthDate, className }: AttendanceCalendarProps) {
   ...
+  const birthMonthDay = birthDate
+    ? `${String(parseISO(birthDate).getMonth() + 1).padStart(2, '0')}-${String(parseISO(birthDate).getDate()).padStart(2, '0')}`
+    : null;
```

날짜 셀 내부에서 `dateStr`의 월-일이 `birthMonthDay`와 같으면 `Cake` 아이콘 overlay 추가:

```tsx
{birthMonthDay && dateStr.slice(5) === birthMonthDay && (
  <Cake className="absolute top-0 right-0 w-2.5 h-2.5 text-pink-500" />
)}
```

(셀 `div`에 `relative` 클래스 필수 추가)

- [ ] **Step 3: 이 컴포넌트의 호출부 점검**

Grep: `AttendanceCalendar` 사용처를 찾아 `birthDate` prop을 전달할 수 있는 곳에서 전달:

```bash
grep -rn "AttendanceCalendar" src/app src/features --include="*.tsx"
```

환자 상세 페이지에서 `<AttendanceCalendar patientId={patient.id} birthDate={patient.birth_date} />`로 수정.

- [ ] **Step 4: 타입/빌드 검증**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/shared/components/AttendanceCalendar.tsx src/app/nurse/patient src/app/staff/patient
git commit -m "feat(calendar): 출석 캘린더에 생일 날짜 오버레이 추가"
```

---

## Phase 2 — 출석 히트맵

### Task 7: AttendanceHeatmap 컴포넌트

**Files:**
- Create: `src/features/shared/components/AttendanceHeatmap.tsx`
- Create: `src/features/shared/hooks/useMultiMonthAttendanceCalendar.ts`

- [ ] **Step 1: 다월 병렬 패치 hook 작성**

```typescript
// src/features/shared/hooks/useMultiMonthAttendanceCalendar.ts
'use client';

import { useQueries } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { sharedKeys } from './query-keys';

interface CalendarData {
  attended_dates: string[];
  scheduled_dates: string[];
  consulted_dates: string[];
}

interface MonthKey {
  year: number;
  month: number; // 1-12
}

export function useMultiMonthAttendanceCalendar(
  patientId: string,
  months: MonthKey[],
  enabled = true,
) {
  const queries = useQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: sharedKeys.attendanceCalendar.detail(patientId, year, month),
      queryFn: async () => {
        const params = new URLSearchParams({
          year: String(year),
          month: String(month),
        });
        const response = await apiClient.get<CalendarData>(
          `/api/shared/patient/${patientId}/attendance-calendar?${params}`,
        );
        return { year, month, data: response.data };
      },
      enabled: enabled && !!patientId,
      staleTime: 5 * 60 * 1000,
    })),
  });

  return {
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    months: queries
      .map((q) => q.data)
      .filter((d): d is { year: number; month: number; data: CalendarData } => !!d),
  };
}
```

- [ ] **Step 2: AttendanceHeatmap 컴포넌트 작성**

```tsx
// src/features/shared/components/AttendanceHeatmap.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  subMonths,
  isSameDay,
} from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMultiMonthAttendanceCalendar } from '../hooks/useMultiMonthAttendanceCalendar';

interface Props {
  patientId: string;
  className?: string;
}

function buildMonths(count: number): { year: number; month: number }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = subMonths(now, count - 1 - i);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export function AttendanceHeatmap({ patientId, className }: Props) {
  const [range, setRange] = useState<3 | 12>(3);
  const months = useMemo(() => buildMonths(range), [range]);
  const { isLoading, months: data } = useMultiMonthAttendanceCalendar(patientId, months);

  const attendedSet = new Set<string>();
  const scheduledSet = new Set<string>();
  const consultedSet = new Set<string>();

  for (const m of data) {
    m.data.attended_dates.forEach((d) => attendedSet.add(d));
    m.data.scheduled_dates.forEach((d) => scheduledSet.add(d));
    m.data.consulted_dates.forEach((d) => consultedSet.add(d));
  }

  const startDate = startOfWeek(startOfMonth(subMonths(new Date(), range - 1)), {
    weekStartsOn: 0,
  });
  const endDate = endOfWeek(endOfMonth(new Date()), { weekStartsOn: 0 });
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });

  // 주 단위로 그룹
  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  const getCellClass = (day: Date): string => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const attended = attendedSet.has(dateStr);
    const consulted = consultedSet.has(dateStr);
    const scheduledAbsent = scheduledSet.has(dateStr) && !attended;

    if (attended && consulted) return 'bg-emerald-500';
    if (attended) return 'bg-emerald-200';
    if (scheduledAbsent) return 'bg-red-300';
    return 'bg-gray-100';
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            출석 히트맵
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={range === 3 ? 'default' : 'outline'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setRange(3)}
            >
              3개월
            </Button>
            <Button
              variant={range === 12 ? 'default' : 'outline'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setRange(12)}
            >
              12개월
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {isLoading ? (
          <p className="text-xs text-gray-400 text-center py-4">로딩 중...</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-0.5" style={{ minWidth: weeks.length * 14 }}>
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day) => (
                    <div
                      key={format(day, 'yyyy-MM-dd')}
                      className={cn('w-3 h-3 rounded-sm', getCellClass(day))}
                      title={`${format(day, 'yyyy-MM-dd')}`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-2 text-[10px] text-gray-500 justify-center">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                출석+진찰
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" />
                출석만
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" />
                예정미출석
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-gray-100 inline-block" />
                비예정
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 타입/빌드 검증**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/shared/components/AttendanceHeatmap.tsx src/features/shared/hooks/useMultiMonthAttendanceCalendar.ts
git commit -m "feat(heatmap): 환자 출석 히트맵 컴포넌트 및 다월 병렬 fetch 훅 추가"
```

---

### Task 8: 환자 상세 페이지에 히트맵 섹션 통합

**Files:**
- Modify: `src/app/nurse/patient/[id]/page.tsx`
- Modify: `src/app/staff/patient/[id]/page.tsx`

- [ ] **Step 1: nurse patient 상세 페이지에 섹션 추가**

기존 `<AttendanceCalendar ... />` 바로 아래 또는 위에 히트맵 섹션 추가:

```tsx
import { AttendanceHeatmap } from '@/features/shared/components/AttendanceHeatmap';

// ... 기존 JSX 내부
<AttendanceHeatmap patientId={patient.id} />
```

히트맵을 월간 캘린더 바로 아래에 배치.

- [ ] **Step 2: staff patient 상세 페이지에 동일 통합**

동일 패턴으로 `src/app/staff/patient/[id]/page.tsx`에 추가.

- [ ] **Step 3: 브라우저 수동 확인**

- `/nurse/patient/<id>` 접속 → 히트맵 3개월 보임, 12개월 버튼 눌러서 확장 동작 확인
- `/staff/patient/<id>` 동일
- 콘솔 에러 없음
- 기존 `AttendanceCalendar`가 그대로 동작하는지 확인

- [ ] **Step 4: 타입/빌드 검증**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/nurse/patient src/app/staff/patient
git commit -m "feat(patient-detail): 환자 상세 페이지에 출석 히트맵 섹션 통합"
```

---

## Phase 3 — 오늘의 하이라이트 카드

### Task 9: Highlights backend 스키마 + error

**Files:**
- Create: `src/features/highlights/backend/schema.ts`
- Create: `src/features/highlights/backend/error.ts`

- [ ] **Step 1: schema.ts 작성**

```typescript
// src/features/highlights/backend/schema.ts
import { z } from 'zod';

export const HighlightPatientSchema = z.object({
  id: z.string(),
  name: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  room_number: z.string().nullable(),
  meta: z.string().optional(),
});

export const TodayHighlightsResponseSchema = z.object({
  date: z.string(),
  events: z.object({
    threeDayAbsence: z.array(HighlightPatientSchema),
    suddenAbsence: z.array(HighlightPatientSchema),
    examMissed: z.array(HighlightPatientSchema),
    birthdays: z.array(HighlightPatientSchema),
    newlyRegistered: z.array(HighlightPatientSchema),
  }),
});

export type HighlightPatient = z.infer<typeof HighlightPatientSchema>;
export type TodayHighlightsResponse = z.infer<typeof TodayHighlightsResponseSchema>;
```

- [ ] **Step 2: error.ts 작성**

```typescript
// src/features/highlights/backend/error.ts
export enum HighlightsErrorCode {
  FETCH_FAILED = 'HIGHLIGHTS_FETCH_FAILED',
}

export class HighlightsError extends Error {
  constructor(
    public code: HighlightsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HighlightsError';
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/features/highlights/backend/schema.ts src/features/highlights/backend/error.ts
git commit -m "feat(highlights): 하이라이트 카드 schema와 error 정의 추가"
```

---

### Task 10: Highlights service + TDD

**Files:**
- Create: `src/features/highlights/backend/service.ts`
- Create: `src/features/highlights/backend/service.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/features/highlights/backend/service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeTodayHighlights } from './service';

// Minimal mock Supabase client
function mockSupabase(tables: Record<string, unknown[]>) {
  return {
    from: (table: string) => ({
      select: () => ({
        gte: () => ({ lte: () => ({ data: tables[table] || [], error: null }) }),
        eq: () => ({ data: tables[table] || [], error: null }),
        order: () => ({ data: tables[table] || [], error: null }),
      }),
    }),
  };
}

describe('computeTodayHighlights', () => {
  const today = new Date('2026-04-11');

  it('오늘 생일인 환자를 birthdays에 포함', async () => {
    const supabase = mockSupabase({
      patients: [
        { id: 'p1', name: '홍길동', birth_date: '1974-04-11', display_name: null, avatar_url: null, room_number: '3101' },
        { id: 'p2', name: '이순신', birth_date: '1974-05-15', display_name: null, avatar_url: null, room_number: '3102' },
      ],
      attendances: [],
      scheduled_attendances: [],
      consultations: [],
    });

    const result = await computeTodayHighlights(supabase as any, today);

    expect(result.events.birthdays).toHaveLength(1);
    expect(result.events.birthdays[0].id).toBe('p1');
  });

  it('오늘 등록된 환자를 newlyRegistered에 포함', async () => {
    const supabase = mockSupabase({
      patients: [
        { id: 'p3', name: '김철수', birth_date: null, created_at: '2026-04-11T09:00:00Z', display_name: null, avatar_url: null, room_number: null },
      ],
    });

    const result = await computeTodayHighlights(supabase as any, today);
    expect(result.events.newlyRegistered.some((p) => p.id === 'p3')).toBe(true);
  });

  it('아무 이벤트도 없으면 모든 배열이 빈 배열', async () => {
    const supabase = mockSupabase({});
    const result = await computeTodayHighlights(supabase as any, today);
    expect(result.events.threeDayAbsence).toEqual([]);
    expect(result.events.suddenAbsence).toEqual([]);
    expect(result.events.examMissed).toEqual([]);
    expect(result.events.birthdays).toEqual([]);
    expect(result.events.newlyRegistered).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행(FAIL 확인)**

Run: `npm test src/features/highlights/backend/service.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: service.ts 구현**

```typescript
// src/features/highlights/backend/service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';
import { isBirthdayToday } from '@/lib/birthday';
import type { Database } from '@/lib/supabase/types';
import type { HighlightPatient, TodayHighlightsResponse } from './schema';
import { HighlightsError, HighlightsErrorCode } from './error';

type DB = SupabaseClient<Database>;

interface PatientRow {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  room_number: string | null;
  birth_date: string | null;
  created_at: string;
  status: string;
}

function toHighlightPatient(row: PatientRow, meta?: string): HighlightPatient {
  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    room_number: row.room_number,
    meta,
  };
}

export async function computeTodayHighlights(
  supabase: DB,
  now: Date = new Date(),
): Promise<TodayHighlightsResponse> {
  const todayStr = format(now, 'yyyy-MM-dd');
  const fourteenDaysAgo = format(subDays(now, 14), 'yyyy-MM-dd');

  // 활성 환자 전체 가져옴 (소규모 데이터셋 가정)
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, name, display_name, avatar_url, room_number, birth_date, created_at, status')
    .eq('status', 'active');

  if (patientsError) {
    throw new HighlightsError(
      HighlightsErrorCode.FETCH_FAILED,
      `환자 조회 실패: ${patientsError.message}`,
    );
  }

  const activePatients = (patients || []) as unknown as PatientRow[];

  // 최근 14일치 attendances / scheduled / consultations
  const [{ data: attRows }, { data: schRows }, { data: consRows }] = await Promise.all([
    supabase
      .from('attendances')
      .select('patient_id, date')
      .gte('date', fourteenDaysAgo)
      .lte('date', todayStr),
    supabase
      .from('scheduled_attendances')
      .select('patient_id, date, is_cancelled')
      .gte('date', fourteenDaysAgo)
      .lte('date', todayStr),
    supabase
      .from('consultations')
      .select('patient_id, date')
      .gte('date', fourteenDaysAgo)
      .lte('date', todayStr),
  ]);

  const attendanceMap = new Map<string, Set<string>>();
  const scheduledMap = new Map<string, Set<string>>();
  const consultationTodaySet = new Set<string>();
  const attendanceTodaySet = new Set<string>();

  for (const row of (attRows as { patient_id: string; date: string }[] | null) || []) {
    if (!attendanceMap.has(row.patient_id)) attendanceMap.set(row.patient_id, new Set());
    attendanceMap.get(row.patient_id)!.add(row.date);
    if (row.date === todayStr) attendanceTodaySet.add(row.patient_id);
  }
  for (const row of (schRows as { patient_id: string; date: string; is_cancelled: boolean }[] | null) || []) {
    if (row.is_cancelled) continue;
    if (!scheduledMap.has(row.patient_id)) scheduledMap.set(row.patient_id, new Set());
    scheduledMap.get(row.patient_id)!.add(row.date);
  }
  for (const row of (consRows as { patient_id: string; date: string }[] | null) || []) {
    if (row.date === todayStr) consultationTodaySet.add(row.patient_id);
  }

  const threeDayAbsence: HighlightPatient[] = [];
  const suddenAbsence: HighlightPatient[] = [];
  const examMissed: HighlightPatient[] = [];
  const birthdays: HighlightPatient[] = [];
  const newlyRegistered: HighlightPatient[] = [];

  const yyyyMmDd = todayStr;
  const recent3Days = [0, 1, 2].map((offset) => format(subDays(now, offset), 'yyyy-MM-dd'));

  for (const p of activePatients) {
    const scheduled = scheduledMap.get(p.id) || new Set<string>();
    const attended = attendanceMap.get(p.id) || new Set<string>();

    // 1. 3일 연속 결석 (최근 3일 중 예정 있었고 출석 0)
    const recentScheduled = recent3Days.filter((d) => scheduled.has(d));
    const recentAttended = recent3Days.filter((d) => attended.has(d));
    if (recentScheduled.length >= 3 && recentAttended.length === 0) {
      threeDayAbsence.push(toHighlightPatient(p, '3일 연속 결석'));
    }

    // 2. 갑작스런 결석 (최근 14일 예정 많음, 출석률 ≥90%, 오늘 예정인데 결석)
    const scheduledCount = scheduled.size;
    const attendedCount = attended.size;
    if (
      scheduledCount >= 5 &&
      attendedCount / scheduledCount >= 0.9 &&
      scheduled.has(todayStr) &&
      !attended.has(todayStr)
    ) {
      suddenAbsence.push(toHighlightPatient(p, '평소 개근자'));
    }

    // 3. 진찰 누락 (오늘 출석했는데 진찰 없음)
    if (attendanceTodaySet.has(p.id) && !consultationTodaySet.has(p.id)) {
      examMissed.push(toHighlightPatient(p));
    }

    // 4. 오늘 생일
    if (isBirthdayToday(p.birth_date, now)) {
      birthdays.push(toHighlightPatient(p, '🎂 오늘 생일'));
    }

    // 5. 신규 등록 (오늘 created_at)
    if (p.created_at && p.created_at.slice(0, 10) === todayStr) {
      newlyRegistered.push(toHighlightPatient(p, '신규 등록'));
    }
  }

  return {
    date: todayStr,
    events: {
      threeDayAbsence: threeDayAbsence.slice(0, 10),
      suddenAbsence: suddenAbsence.slice(0, 10),
      examMissed: examMissed.slice(0, 10),
      birthdays,
      newlyRegistered,
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test src/features/highlights/backend/service.test.ts`
Expected: 3 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/highlights/backend/service.ts src/features/highlights/backend/service.test.ts
git commit -m "feat(highlights): 오늘의 하이라이트 이벤트 계산 서비스 추가"
```

---

### Task 11: Highlights Hono route + 등록

**Files:**
- Create: `src/features/highlights/backend/route.ts`
- Modify: `src/features/shared/backend/route.ts`

- [ ] **Step 1: route.ts 작성**

```typescript
// src/features/highlights/backend/route.ts
import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { computeTodayHighlights } from './service';
import { HighlightsError } from './error';

const highlightsRoutes = new Hono<AppEnv>();

highlightsRoutes.get('/today', async (c) => {
  const supabase = c.get('supabase');
  try {
    const result = await computeTodayHighlights(supabase);
    return respond(c, success(result, 200));
  } catch (err) {
    if (err instanceof HighlightsError) {
      return respond(c, failure(500, err.code, err.message));
    }
    throw err;
  }
});

export default highlightsRoutes;
```

- [ ] **Step 2: shared route에 등록**

`src/features/shared/backend/route.ts`의 상단 import:

```diff
 import absenceRiskRoutes from '@/features/absence-risk/backend/route';
+import highlightsRoutes from '@/features/highlights/backend/route';
```

파일 하단 라우트 등록부(Absence Risk 등록 부근):

```diff
 sharedRoutes.route('/absence-risk', absenceRiskRoutes);
+sharedRoutes.route('/highlights', highlightsRoutes);
```

최종 경로: `GET /api/shared/highlights/today`

- [ ] **Step 3: 타입/빌드 검증**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/highlights/backend/route.ts src/features/shared/backend/route.ts
git commit -m "feat(highlights): /api/shared/highlights/today 엔드포인트 등록"
```

---

### Task 12: useTodayHighlights 훅 + dto

**Files:**
- Create: `src/features/highlights/lib/dto.ts`
- Create: `src/features/highlights/hooks/useTodayHighlights.ts`

- [ ] **Step 1: dto.ts 작성**

```typescript
// src/features/highlights/lib/dto.ts
export {
  TodayHighlightsResponseSchema,
  HighlightPatientSchema,
} from '../backend/schema';
export type {
  TodayHighlightsResponse,
  HighlightPatient,
} from '../backend/schema';
```

- [ ] **Step 2: 훅 작성**

```typescript
// src/features/highlights/hooks/useTodayHighlights.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { TodayHighlightsResponse } from '../lib/dto';

export function useTodayHighlights() {
  return useQuery<TodayHighlightsResponse>({
    queryKey: ['highlights', 'today'],
    queryFn: async () => {
      const response = await apiClient.get<TodayHighlightsResponse>(
        '/api/shared/highlights/today',
      );
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10분
    refetchOnWindowFocus: false,
  });
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/features/highlights/lib src/features/highlights/hooks
git commit -m "feat(highlights): useTodayHighlights 훅과 dto 추가"
```

---

### Task 13: TodayHighlightCard 컴포넌트

**Files:**
- Create: `src/features/highlights/components/TodayHighlightCard.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/features/highlights/components/TodayHighlightCard.tsx
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertTriangle, AlertCircle, Stethoscope, Cake, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTodayHighlights } from '../hooks/useTodayHighlights';
import type { HighlightPatient } from '../lib/dto';

interface Props {
  patientLinkPrefix: string; // 예: "/nurse/patient" 또는 "/staff/patient"
  className?: string;
}

interface EventGroupProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  patients: HighlightPatient[];
  linkPrefix: string;
}

function EventGroup({ title, icon, color, patients, linkPrefix }: EventGroupProps) {
  if (patients.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className={cn('flex items-center gap-1 text-xs font-medium', color)}>
        {icon}
        {title}
        <span className="text-gray-400">({patients.length})</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {patients.map((p) => (
          <Link key={p.id} href={`${linkPrefix}/${p.id}`}>
            <Badge
              variant="outline"
              className={cn('cursor-pointer hover:bg-gray-50', color, 'border-current')}
            >
              {p.display_name || p.name}
              {p.room_number && <span className="ml-1 text-[10px] opacity-60">{p.room_number}</span>}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function TodayHighlightCard({ patientLinkPrefix, className }: Props) {
  const { data, isLoading, isError } = useTodayHighlights();

  return (
    <Card className={className}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          오늘의 하이라이트
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        {isLoading ? (
          <p className="text-xs text-gray-400 text-center py-2">불러오는 중...</p>
        ) : isError || !data ? (
          <p className="text-xs text-red-400 text-center py-2">불러오지 못했습니다</p>
        ) : (
          <>
            <EventGroup
              title="3일 연속 결석"
              icon={<AlertTriangle className="w-3 h-3" />}
              color="text-amber-600"
              patients={data.events.threeDayAbsence}
              linkPrefix={patientLinkPrefix}
            />
            <EventGroup
              title="갑작스런 결석"
              icon={<AlertCircle className="w-3 h-3" />}
              color="text-red-600"
              patients={data.events.suddenAbsence}
              linkPrefix={patientLinkPrefix}
            />
            <EventGroup
              title="진찰 누락"
              icon={<Stethoscope className="w-3 h-3" />}
              color="text-blue-600"
              patients={data.events.examMissed}
              linkPrefix={patientLinkPrefix}
            />
            <EventGroup
              title="오늘 생일"
              icon={<Cake className="w-3 h-3" />}
              color="text-pink-600"
              patients={data.events.birthdays}
              linkPrefix={patientLinkPrefix}
            />
            <EventGroup
              title="신규 등록"
              icon={<UserPlus className="w-3 h-3" />}
              color="text-emerald-600"
              patients={data.events.newlyRegistered}
              linkPrefix={patientLinkPrefix}
            />
            {Object.values(data.events).every((arr) => arr.length === 0) && (
              <p className="text-xs text-gray-400 text-center py-2">오늘은 특이사항이 없습니다</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/features/highlights/components/TodayHighlightCard.tsx
git commit -m "feat(highlights): TodayHighlightCard 컴포넌트 추가"
```

---

### Task 14: 4개 역할 페이지에 하이라이트 카드 통합

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx`
- Modify: `src/app/staff/dashboard/page.tsx`
- Modify: `src/app/nurse/tasks/page.tsx` (또는 `src/features/nurse/components/TasksPageContent.tsx`)
- Modify: `src/app/doctor/history/page.tsx`

- [ ] **Step 1: admin dashboard 통합**

`src/app/admin/dashboard/page.tsx`의 `return (<>...</>)` 최상단에 배치:

```diff
+import { TodayHighlightCard } from '@/features/highlights/components/TodayHighlightCard';

 return (
   <>
+    <div className="px-4 pt-4">
+      <TodayHighlightCard patientLinkPrefix="/admin/patient" />
+    </div>
     <MasterDetailLayout ... />
```

admin 환자 링크가 존재하지 않는다면 `/admin/dashboard`로 두고, 카드 내 링크를 클릭해도 문제가 없도록 우선 `patientLinkPrefix="/staff/patient"` 같은 실존 경로로 설정 후 추후 admin 전용 경로 생기면 교체.

**실존 경로 확인 필수:** 각 역할별 환자 상세 경로가 실제로 어디인지 확인:
```bash
ls src/app/*/patient/
```

admin은 환자 상세 페이지가 없을 가능성이 높으므로, `/admin/dashboard` 경로 + query param 전달 방식이 필요하면 해당 페이지의 `selectedPatientId` 셋 로직을 활용할 수 있음. 우선은 **admin은 링크를 `staff/patient` 경로로 보내는 선택**이 가장 단순.

- [ ] **Step 2: staff dashboard 통합**

`src/app/staff/dashboard/page.tsx`의 최상단에 동일 삽입:

```tsx
<div className="px-4 pt-4">
  <TodayHighlightCard patientLinkPrefix="/staff/patient" />
</div>
```

- [ ] **Step 3: nurse tasks 페이지 통합**

`src/app/nurse/tasks/page.tsx`는 `TasksPageContent`에 위임하므로, 해당 컴포넌트 상단에 삽입:

`src/features/doctor/components/TasksPageContent.tsx` 혹은 nurse 쪽의 실제 구현 파일 최상단 JSX에:

```tsx
<TodayHighlightCard patientLinkPrefix="/nurse/patient" className="mb-4" />
```

페이지 로딩 시 카드가 task 리스트 위에 보이는 형태.

- [ ] **Step 4: doctor history 페이지 통합**

`src/app/doctor/history/page.tsx` 리스트 뷰 상단에 삽입:

```tsx
<TodayHighlightCard patientLinkPrefix="/doctor/history" className="mb-4" />
```

- [ ] **Step 5: 수동 브라우저 QA**

각 역할로 로그인 → 페이지 상단에 하이라이트 카드 정상 표시, 환자 링크 클릭 시 상세 이동, 기존 레이아웃 깨짐 없음 확인.

- [ ] **Step 6: 타입/빌드 검증**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -30`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/app src/features/doctor/components/TasksPageContent.tsx 2>/dev/null
git commit -m "feat(dashboard): 4개 역할 페이지에 TodayHighlightCard 통합"
```

---

## Phase 4 — 환자 타임라인 (가로 요약)

### Task 15: Patient Timeline backend 스키마 + error

**Files:**
- Create: `src/features/patient-timeline/backend/schema.ts`
- Create: `src/features/patient-timeline/backend/error.ts`

- [ ] **Step 1: schema.ts 작성**

```typescript
// src/features/patient-timeline/backend/schema.ts
import { z } from 'zod';

export const TimelineEventTypeSchema = z.enum([
  'attendance',
  'consultation',
  'message',
  'absence',
  'admission',
  'discharge',
  'birthday',
]);

export const TimelineEventSchema = z.object({
  date: z.string(),
  type: TimelineEventTypeSchema,
  label: z.string(),
});

export const PatientTimelineResponseSchema = z.object({
  patientId: z.string(),
  range: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  events: z.array(TimelineEventSchema),
});

export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type PatientTimelineResponse = z.infer<typeof PatientTimelineResponseSchema>;
```

- [ ] **Step 2: error.ts 작성**

```typescript
// src/features/patient-timeline/backend/error.ts
export enum PatientTimelineErrorCode {
  FETCH_FAILED = 'PATIENT_TIMELINE_FETCH_FAILED',
  PATIENT_NOT_FOUND = 'PATIENT_TIMELINE_PATIENT_NOT_FOUND',
}

export class PatientTimelineError extends Error {
  constructor(
    public code: PatientTimelineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PatientTimelineError';
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/features/patient-timeline/backend/schema.ts src/features/patient-timeline/backend/error.ts
git commit -m "feat(timeline): 환자 타임라인 schema와 error 정의 추가"
```

---

### Task 16: Patient Timeline service + TDD

**Files:**
- Create: `src/features/patient-timeline/backend/service.ts`
- Create: `src/features/patient-timeline/backend/service.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/features/patient-timeline/backend/service.test.ts
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
```

- [ ] **Step 2: 테스트 실행(FAIL 확인)**

Run: `npm test src/features/patient-timeline/backend/service.test.ts`
Expected: FAIL

- [ ] **Step 3: service.ts 구현**

```typescript
// src/features/patient-timeline/backend/service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { format, parseISO, isValid } from 'date-fns';
import type { Database } from '@/lib/supabase/types';
import type { PatientTimelineResponse, TimelineEvent } from './schema';
import { PatientTimelineError, PatientTimelineErrorCode } from './error';

type DB = SupabaseClient<Database>;

interface PatientRow {
  id: string;
  created_at: string;
  birth_date: string | null;
  status: string;
  updated_at: string;
}

interface BuildInput {
  patient: PatientRow;
  attendances: { date: string }[];
  scheduledAttendances: { date: string }[];
  consultations: { date: string }[];
  messages: { created_at: string }[];
  today: Date;
}

export function buildTimelineEvents(input: BuildInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const { patient, attendances, scheduledAttendances, consultations, messages, today } = input;

  // Admission
  const admissionDate = patient.created_at.slice(0, 10);
  events.push({ date: admissionDate, type: 'admission', label: '입원' });

  // Attendance
  const attendedSet = new Set(attendances.map((a) => a.date));
  for (const a of attendances) {
    events.push({ date: a.date, type: 'attendance', label: '출석' });
  }

  // Absence (scheduled and not attended)
  for (const s of scheduledAttendances) {
    if (!attendedSet.has(s.date)) {
      events.push({ date: s.date, type: 'absence', label: '결석' });
    }
  }

  // Consultation
  for (const c of consultations) {
    events.push({ date: c.date, type: 'consultation', label: '진찰' });
  }

  // Messages
  for (const m of messages) {
    events.push({ date: m.created_at.slice(0, 10), type: 'message', label: '메시지' });
  }

  // Birthday events (admission to today, per year)
  if (patient.birth_date) {
    const birth = parseISO(patient.birth_date);
    if (isValid(birth)) {
      const admissionYear = parseISO(admissionDate).getFullYear();
      const todayYear = today.getFullYear();
      for (let y = admissionYear; y <= todayYear; y++) {
        const birthday = new Date(y, birth.getMonth(), birth.getDate());
        const dateStr = format(birthday, 'yyyy-MM-dd');
        if (dateStr >= admissionDate && dateStr <= format(today, 'yyyy-MM-dd')) {
          events.push({ date: dateStr, type: 'birthday', label: '🎂 생일' });
        }
      }
    }
  }

  // Discharge (approximate from updated_at when status=discharged)
  if (patient.status === 'discharged') {
    events.push({
      date: patient.updated_at.slice(0, 10),
      type: 'discharge',
      label: '퇴원',
    });
  }

  // Sort by date
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return events;
}

export async function getPatientTimeline(
  supabase: DB,
  patientId: string,
  now: Date = new Date(),
): Promise<PatientTimelineResponse> {
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, created_at, birth_date, status, updated_at')
    .eq('id', patientId)
    .single();

  if (patientError || !patient) {
    throw new PatientTimelineError(
      PatientTimelineErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  const admissionDate = (patient.created_at as string).slice(0, 10);
  const todayStr = format(now, 'yyyy-MM-dd');

  const [{ data: attRows }, { data: schRows }, { data: consRows }, { data: msgRows }] =
    await Promise.all([
      supabase.from('attendances').select('date').eq('patient_id', patientId).gte('date', admissionDate).lte('date', todayStr),
      supabase.from('scheduled_attendances').select('date, is_cancelled').eq('patient_id', patientId).eq('is_cancelled', false).gte('date', admissionDate).lte('date', todayStr),
      supabase.from('consultations').select('date').eq('patient_id', patientId).gte('date', admissionDate).lte('date', todayStr),
      supabase.from('messages').select('created_at').eq('patient_id', patientId).gte('created_at', admissionDate).lte('created_at', todayStr + 'T23:59:59Z'),
    ]);

  const events = buildTimelineEvents({
    patient: patient as unknown as PatientRow,
    attendances: (attRows || []) as { date: string }[],
    scheduledAttendances: (schRows || []) as { date: string }[],
    consultations: (consRows || []) as { date: string }[],
    messages: (msgRows || []) as { created_at: string }[],
    today: now,
  });

  return {
    patientId,
    range: { startDate: admissionDate, endDate: todayStr },
    events,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test src/features/patient-timeline/backend/service.test.ts`
Expected: 4 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/patient-timeline/backend/service.ts src/features/patient-timeline/backend/service.test.ts
git commit -m "feat(timeline): 환자 타임라인 이벤트 빌더와 서비스 구현"
```

---

### Task 17: Patient Timeline route + 등록

**Files:**
- Create: `src/features/patient-timeline/backend/route.ts`
- Modify: `src/features/shared/backend/route.ts`

- [ ] **Step 1: route.ts 작성**

```typescript
// src/features/patient-timeline/backend/route.ts
import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { getPatientTimeline } from './service';
import { PatientTimelineError, PatientTimelineErrorCode } from './error';

const patientTimelineRoutes = new Hono<AppEnv>();

patientTimelineRoutes.get('/:id/timeline', async (c) => {
  const supabase = c.get('supabase');
  const patientId = c.req.param('id');
  try {
    const result = await getPatientTimeline(supabase, patientId);
    return respond(c, success(result, 200));
  } catch (err) {
    if (err instanceof PatientTimelineError) {
      const status = err.code === PatientTimelineErrorCode.PATIENT_NOT_FOUND ? 404 : 500;
      return respond(c, failure(status, err.code, err.message));
    }
    throw err;
  }
});

export default patientTimelineRoutes;
```

- [ ] **Step 2: shared route에 등록**

`src/features/shared/backend/route.ts`의 import:

```diff
+import patientTimelineRoutes from '@/features/patient-timeline/backend/route';
```

등록:

```diff
+sharedRoutes.route('/patient', patientTimelineRoutes);
```

최종 경로: `GET /api/shared/patient/:id/timeline`

주의: 기존 `/patient/:id/attendance-calendar` 엔드포인트와 충돌하지 않도록, sub-route로 두는 대신 sharedRoutes에 직접 정의하는 편이 안전할 수 있음. 만약 충돌하면 다음 패턴으로 변경:

```typescript
sharedRoutes.get('/patient/:id/timeline', async (c) => {
  // ... 위 route.ts의 핸들러 바디 복사
});
```

- [ ] **Step 3: 수동 테스트**

Run: `npm run dev`
브라우저에서 `/api/shared/patient/<id>/timeline` 호출 → 200 OK, `events` 배열 정상 반환 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/features/patient-timeline/backend/route.ts src/features/shared/backend/route.ts
git commit -m "feat(timeline): /api/shared/patient/:id/timeline 엔드포인트 등록"
```

---

### Task 18: usePatientTimeline 훅 + dto

**Files:**
- Create: `src/features/patient-timeline/lib/dto.ts`
- Create: `src/features/patient-timeline/hooks/usePatientTimeline.ts`

- [ ] **Step 1: dto.ts**

```typescript
// src/features/patient-timeline/lib/dto.ts
export {
  PatientTimelineResponseSchema,
  TimelineEventSchema,
  TimelineEventTypeSchema,
} from '../backend/schema';
export type {
  PatientTimelineResponse,
  TimelineEvent,
  TimelineEventType,
} from '../backend/schema';
```

- [ ] **Step 2: 훅**

```typescript
// src/features/patient-timeline/hooks/usePatientTimeline.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { PatientTimelineResponse } from '../lib/dto';

export function usePatientTimeline(patientId: string, enabled = true) {
  return useQuery<PatientTimelineResponse>({
    queryKey: ['patient-timeline', patientId],
    queryFn: async () => {
      const response = await apiClient.get<PatientTimelineResponse>(
        `/api/shared/patient/${patientId}/timeline`,
      );
      return response.data;
    },
    enabled: enabled && !!patientId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/features/patient-timeline/lib src/features/patient-timeline/hooks
git commit -m "feat(timeline): usePatientTimeline 훅과 dto 추가"
```

---

### Task 19: PatientTimelineStrip 컴포넌트

**Files:**
- Create: `src/features/patient-timeline/components/PatientTimelineStrip.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/features/patient-timeline/components/PatientTimelineStrip.tsx
'use client';

import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Check,
  Stethoscope,
  MessageSquare,
  X,
  LogIn,
  LogOut,
  Cake,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePatientTimeline } from '../hooks/usePatientTimeline';
import type { TimelineEvent, TimelineEventType } from '../lib/dto';

interface Props {
  patientId: string;
  className?: string;
}

const ICON_MAP: Record<TimelineEventType, React.ComponentType<{ className?: string }>> = {
  attendance: Check,
  consultation: Stethoscope,
  message: MessageSquare,
  absence: X,
  admission: LogIn,
  discharge: LogOut,
  birthday: Cake,
};

const COLOR_MAP: Record<TimelineEventType, string> = {
  attendance: 'text-emerald-600 bg-emerald-50',
  consultation: 'text-blue-600 bg-blue-50',
  message: 'text-slate-600 bg-slate-50',
  absence: 'text-red-600 bg-red-50',
  admission: 'text-green-700 bg-green-100',
  discharge: 'text-gray-600 bg-gray-100',
  birthday: 'text-pink-600 bg-pink-50',
};

function groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const map = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return map;
}

export function PatientTimelineStrip({ patientId, className }: Props) {
  const { data, isLoading, isError } = usePatientTimeline(patientId);

  const handleClick = useCallback((date: string) => {
    const el = document.querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-300');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-300');
      }, 1500);
    }
  }, []);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            타임라인 요약
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) return null;

  const groups = groupByDate(data.events);
  const sortedDates = Array.from(groups.keys()).sort();

  return (
    <Card className={className}>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          타임라인 요약
          <span className="text-[10px] text-gray-400 font-normal ml-1">
            ({data.range.startDate} ~ {data.range.endDate})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {sortedDates.map((date) => {
              const events = groups.get(date)!;
              return (
                <button
                  key={date}
                  type="button"
                  className="flex flex-col items-center gap-0.5 p-1 rounded hover:bg-gray-50 transition-colors"
                  onClick={() => handleClick(date)}
                  title={`${date} — ${events.map((e) => e.label).join(', ')}`}
                >
                  <div className="flex flex-col gap-0.5">
                    {events.map((e, idx) => {
                      const Icon = ICON_MAP[e.type];
                      return (
                        <div
                          key={`${e.type}-${idx}`}
                          className={cn('w-4 h-4 rounded flex items-center justify-center', COLOR_MAP[e.type])}
                        >
                          <Icon className="w-2.5 h-2.5" />
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[8px] text-gray-400 whitespace-nowrap">
                    {date.slice(5)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/features/patient-timeline/components/PatientTimelineStrip.tsx
git commit -m "feat(timeline): PatientTimelineStrip 가로 요약 컴포넌트 추가"
```

---

### Task 20: ConsultationHistory에 `data-date` 속성 추가

**Files:**
- Modify: `src/features/doctor/components/ConsultationHistory.tsx`

- [ ] **Step 1: 메시지/진찰 아이템 렌더 JSX에 data-date 속성 추가**

ConsultationHistory에서 각 아이템을 렌더하는 외부 `<div>`에 `data-date={item.date}` 속성을 붙인다. 정확한 변경 지점은 파일 내에서 각 consultation/message item의 outer `<div>` (카드처럼 묶이는 컨테이너). 기존 클래스/로직은 손대지 않고 속성만 추가.

예시:

```diff
 return (
-  <div className="mt-1.5 p-2 bg-blue-50 rounded text-sm group relative">
+  <div className="mt-1.5 p-2 bg-blue-50 rounded text-sm group relative" data-date={message.date}>
     ...
```

그리고 consultation 그룹(날짜별 그룹핑) 컨테이너에도 `data-date={dateStr}` 추가. 이 파일은 546줄이므로 "날짜가 표시되는 블록"마다 속성을 추가해서 스크롤 타겟이 되게 한다.

- [ ] **Step 2: 수동 확인**

브라우저 DevTools에서 `document.querySelectorAll('[data-date]')` 를 실행해서 날짜 타겟이 여러 개 잡히는지 확인.

- [ ] **Step 3: 타입/빌드 검증**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/doctor/components/ConsultationHistory.tsx
git commit -m "feat(consultation-history): 타임라인 스크롤 연동용 data-date 속성 추가"
```

---

### Task 21: 환자 상세 페이지에 타임라인 스트립 통합

**Files:**
- Modify: `src/app/nurse/patient/[id]/page.tsx`
- Modify: `src/app/staff/patient/[id]/page.tsx`
- Modify: `src/app/doctor/history/[id]/page.tsx`

- [ ] **Step 1: nurse patient 상세에 통합**

기존 `ConsultationHistory` 컴포넌트 바로 **위에** 타임라인 스트립 추가:

```tsx
import { PatientTimelineStrip } from '@/features/patient-timeline/components/PatientTimelineStrip';

// JSX 내부, ConsultationHistory 바로 위에
<PatientTimelineStrip patientId={patient.id} />
<ConsultationHistory ... />
```

- [ ] **Step 2: staff patient 상세에 통합**

동일 패턴.

- [ ] **Step 3: doctor history 상세에 통합**

`src/app/doctor/history/[id]/page.tsx`의 `<PatientHistoryCard>` 와 `<ConsultationHistory>` 사이에 삽입:

```tsx
<div className="space-y-6">
  <PatientHistoryCard patient={history.patient} />
  <PatientTimelineStrip patientId={history.patient.id} />
  <ConsultationHistory ... />
  <MessageHistory ... />
</div>
```

- [ ] **Step 4: 브라우저 수동 QA**

- 3개 페이지 각각에서 타임라인 가로 스트립이 정상 렌더
- 아이콘 클릭 시 ConsultationHistory 내 해당 날짜로 스크롤 + ring highlight 효과
- 기존 ConsultationHistory 기능(수정/삭제/확장) 정상

- [ ] **Step 5: 타입/빌드 검증**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -30`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/nurse/patient src/app/staff/patient src/app/doctor/history
git commit -m "feat(patient-detail): 환자 상세 페이지 3종에 PatientTimelineStrip 통합"
```

---

## Phase 5 — 최종 검증

### Task 22: 전체 타입/빌드/테스트 실행

- [ ] **Step 1: TypeScript 타입 체크**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: ESLint**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 3: 전체 유닛 테스트**

Run: `npm test -- --run`
Expected: all PASS

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: 0 errors, 모든 페이지 정적 분석 성공

- [ ] **Step 5: 브라우저 수동 QA 체크리스트**

아래 모든 항목을 4개 역할(admin/staff/nurse/doctor) 계정으로 확인:

| 항목 | 기대 결과 |
|------|-----------|
| 각 역할 대시보드 접속 | 상단에 TodayHighlightCard 렌더 |
| 카드 이벤트 0건 상태 | "오늘은 특이사항이 없습니다" 빈 상태 |
| 환자 카드(기존) 생일 없는 환자 | 기존과 동일, 생일 표시 영역 없음 |
| 환자 카드 생일 있는 환자 | `🎂 3/15` 형태 작은 텍스트 |
| 생일 당일 환자 | amber 뱃지 "오늘 생일" |
| `/nurse/patient/<id>`, `/staff/patient/<id>` | AttendanceCalendar(기존) + AttendanceHeatmap(신규) + PatientTimelineStrip(신규) + ConsultationHistory(기존) 모두 동시 렌더 |
| 히트맵 3개월/12개월 토글 | 즉시 전환, 12개월 클릭 후에만 추가 데이터 요청(Network 탭) |
| 타임라인 아이콘 클릭 | ConsultationHistory 해당 날짜로 smooth scroll + ring highlight |
| PatientFormModal 환자 수정 | birth_date 필드 표시 + 저장 후 반영 |
| AttendanceCalendar 생일 날짜 셀 | 우측 상단 핑크 Cake 아이콘 overlay |
| 기존 출석 캘린더 기능 | 월 이동, 출석/결석 색상 등 정상 |
| Network 탭 initial load | 기존 페이지 대비 신규 요청은 최대 2개(`/highlights/today`, `/patient/:id/timeline`)만 추가 |

- [ ] **Step 6: 커밋 (없으면 skip)**

만약 QA 중 수정이 발생했다면:

```bash
git add -p
git commit -m "fix: 실험 기능 통합 QA 피드백 반영"
```

---

## 변경 파일 요약

### 신규 파일
- `supabase/migrations/20260411000001_add_patient_birth_date.sql`
- `src/lib/birthday.ts`
- `src/lib/birthday.test.ts`
- `src/features/shared/components/AttendanceHeatmap.tsx`
- `src/features/shared/hooks/useMultiMonthAttendanceCalendar.ts`
- `src/features/highlights/backend/{schema,error,service,service.test,route}.ts`
- `src/features/highlights/hooks/useTodayHighlights.ts`
- `src/features/highlights/components/TodayHighlightCard.tsx`
- `src/features/highlights/lib/dto.ts`
- `src/features/patient-timeline/backend/{schema,error,service,service.test,route}.ts`
- `src/features/patient-timeline/hooks/usePatientTimeline.ts`
- `src/features/patient-timeline/components/PatientTimelineStrip.tsx`
- `src/features/patient-timeline/lib/dto.ts`

### 수정 파일
- `src/features/nurse/backend/service.ts` (+ schema.ts)
- `src/features/staff/backend/service.ts` (+ schema.ts)
- `src/features/doctor/backend/service.ts` (+ schema.ts)
- `src/features/admin/backend/service.ts` (+ schema.ts)
- `src/features/nurse/components/NursePatientCard.tsx`
- `src/features/staff/components/PatientCard.tsx`
- `src/features/doctor/components/PatientHistoryCard.tsx`
- `src/features/admin/components/PatientFormModal.tsx`
- `src/features/shared/components/AttendanceCalendar.tsx`
- `src/features/shared/backend/route.ts`
- `src/features/doctor/components/ConsultationHistory.tsx` (data-date 속성만)
- `src/app/admin/dashboard/page.tsx`
- `src/app/staff/dashboard/page.tsx`
- `src/app/nurse/tasks/page.tsx` or `src/features/doctor/components/TasksPageContent.tsx`
- `src/app/doctor/history/page.tsx`
- `src/app/nurse/patient/[id]/page.tsx`
- `src/app/staff/patient/[id]/page.tsx`
- `src/app/doctor/history/[id]/page.tsx`

# 휴진일(진찰 없는 날) 관리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 "휴진일"(주치의 휴가 등 출석은 하되 진찰만 없는 날)을 지정하면, 그날은 출석은 정상 집계하되 모든 진찰 지표에서 제외되어 아무도 진찰 불참으로 잡히지 않는다.

**Architecture:** 기존 `holidays`(공휴일)와 분리된 독립 테이블 `clinic_closures`를 추가한다. 공휴일은 출석·진찰 모두 제외하지만, 휴진일은 **진찰 지표에서만** 제외하고 출석은 유지한다. 진찰 지표가 계산되는 모든 지점(기간 통계 평균, 일별 통계 플래그, 월간 리포트, 오늘 하이라이트, 슬랙 정오 리포트, 요일별 통계, 추이 차트)에 휴진일 제외를 적용한다.

**Tech Stack:** Next.js(App Router, Client Component) · Hono 백엔드 · Supabase(Postgres) · React Query · zod · date-fns · vitest · shadcn-ui · Tailwind

## Global Constraints

- 프론트엔드는 전부 Client Component (`"use client"`), 서버 상태는 React Query로만 관리.
- feature HTTP 요청은 `@/lib/remote/api-client` 경유.
- 하드코딩 금지. 응답은 `success`/`failure`/`respond` 패턴.
- 마이그레이션: idempotent, `update_updated_at()` 트리거 재사용, **RLS DISABLE**. Supabase CLI 직결 불가 → MCP `apply_migration`(project_id `hgkhcbdixubimbraigen`)로 사용자 위임.
- **push 금지** — 로컬 커밋만. push는 사용자 확인 후(Vercel 자동 배포).
- 품질 게이트(각 커밋 전 관련 항목, 최종에 전체): `npx tsc --noEmit` / `npx eslint src --quiet` / `npx vitest run` / `npm run build`.
- 커밋: Conventional Commits, 설명 한국어. 커밋 푸터에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **출석률 관련 계산은 절대 건드리지 않는다.** 휴진일은 진찰 지표에서만 뺀다.

---

## 파일 구조 (생성/수정)

> **2차 Codex 리뷰 반영(2026-07-02)**: 코디네이터 진찰 참석률 계산기 태스크 추가(Task 8B), `src/lib/supabase/types.ts` 수기 타입 추가를 Task 1로 승격(Task 3의 tsc 게이트 선결), import 별칭 충돌 수정(Task 4), `calculateDailyStats` 반환 필드(Task 7), `countInDates` 테이블별 분리+error throw(Task 8), StatsDetailTable 공휴일 '제외' 회귀 방지(Task 13), `totalConsultation` 방침 명시(Task 6).

**생성**
- `supabase/migrations/20260702000001_create_clinic_closures_table.sql` — 테이블
- `src/features/admin/components/ClinicClosureManageDialog.tsx` — 관리 UI
- `src/features/admin/hooks/useClinicClosures.ts` — React Query 훅

**수정**
- `src/lib/supabase/types.ts` — 수기 `Database` 타입에 `clinic_closures` 정의 추가(`holidays` 동형) — **Task 3 이전 필수**
- `src/lib/business-days.ts` — `getClinicClosureDatesSet` 헬퍼 추가
- `src/features/admin/backend/schema.ts` — 스키마·타입·`DailyStatsItem.is_clinic_closure`
- `src/features/admin/backend/error.ts` — 에러 코드
- `src/features/admin/backend/service.ts` — CRUD, `aggregateStats` export+시그니처, `getDailyStats`, `getStatsSummary`
- `src/features/admin/backend/route.ts` — `/clinic-closures` 라우트
- `src/features/admin/hooks/query-keys.ts` — 쿼리 키
- `src/features/monthly-report/backend/calculators/consultation.ts` — 휴진일 제외(시그니처 불변)
- `src/features/monthly-report/backend/calculators/coordinator.ts` — 코디별 진찰 참석률 휴진일 제외(시그니처 불변)
- `src/features/highlights/backend/service.ts` — `examMissed` 억제
- `src/server/services/noon-report.ts` — `clinicClosed` 옵션
- `src/app/api/internal/cron/noon-attendance-report/route.ts` — 휴진일 감지·옵션 전달
- `src/features/shared/lib/stats.ts` — 요일별 진찰 평균 휴진일 제외
- `src/features/shared/components/stats/RateLineChart.tsx` — `filterClosures` prop
- `src/features/shared/components/stats/ConsultationRateChart.tsx` — `filterClosures` 전달
- `src/features/shared/components/stats/StatsDetailTable.tsx` — 휴진일 행 진찰 N/A 표시
- `src/app/dashboard/admin/stats/page.tsx` — 다이얼로그 진입점

**테스트**
- `src/features/admin/backend/aggregate-stats.test.ts` (신규) — `aggregateStats`
- `src/features/shared/lib/stats.test.ts` (신규) — `calculateDayOfWeekStats`
- `src/server/services/noon-report.test.ts` (기존 확장) — `clinicClosed`
- `src/features/highlights/backend/service.test.ts` (기존 확장) — 휴진일 `examMissed`

---

## Task 1: DB 마이그레이션 — `clinic_closures` 테이블

**Files:**
- Create: `supabase/migrations/20260702000001_create_clinic_closures_table.sql`

**Interfaces:**
- Produces: 테이블 `clinic_closures(id uuid, date date unique not null, reason varchar(100) not null, created_at, updated_at)`

- [ ] **Step 1: 마이그레이션 파일 작성** (`holidays` 마이그레이션과 동형, `update_updated_at()` 재사용)

```sql
-- clinic_closures 테이블 생성: 휴진일(진찰 없는 날) 관리용
-- holidays(공휴일)와 분리. 휴진일은 출석은 유지, 진찰 지표에서만 제외.
CREATE TABLE IF NOT EXISTS clinic_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  reason VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_closures_date ON clinic_closures(date);

DROP TRIGGER IF EXISTS set_clinic_closures_updated_at ON clinic_closures;
CREATE TRIGGER set_clinic_closures_updated_at
  BEFORE UPDATE ON clinic_closures FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clinic_closures DISABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: 수기 `Database` 타입에 `clinic_closures` 추가** (`src/lib/supabase/types.ts`)

이 레포의 `Database`는 자동생성이 아니라 수기 타입이다(`holidays`가 `:535`에 정의됨). `clinic_closures`가 없으면 Task 3의 `.from('clinic_closures')`에서 tsc 에러가 난다. `holidays:` 블록 바로 위에 동형 정의를 삽입:

```ts
            clinic_closures: {
                Row: {
                    id: string;
                    date: string;
                    reason: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    date: string;
                    reason: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    date?: string;
                    reason?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
```

- [ ] **Step 3: 커밋** (마이그레이션 적용은 최종 Task에서 MCP로 사용자 위임)

```bash
npx tsc --noEmit
git add supabase/migrations/20260702000001_create_clinic_closures_table.sql src/lib/supabase/types.ts
git commit -m "feat(db): 휴진일 clinic_closures 테이블 마이그레이션·타입 추가"
```

---

## Task 2: 백엔드 스키마 + 에러 코드

**Files:**
- Modify: `src/features/admin/backend/schema.ts`
- Modify: `src/features/admin/backend/error.ts`

**Interfaces:**
- Produces:
  - `createClinicClosureSchema` (zod), `getClinicClosuresQuerySchema` (zod)
  - `CreateClinicClosureRequest`, `GetClinicClosuresQuery`, `ClinicClosureItem` 타입
  - `DailyStatsItem.is_clinic_closure: boolean`
  - `AdminErrorCode.CLINIC_CLOSURE_FETCH_FAILED | CLINIC_CLOSURE_CREATE_FAILED | CLINIC_CLOSURE_DELETE_FAILED | CLINIC_CLOSURE_ALREADY_EXISTS`

- [ ] **Step 1: 스키마 추가** (`schema.ts`, Holidays 스키마 블록 아래에 삽입)

```ts
// ========== Clinic Closures API Schemas ==========

export const createClinicClosureSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  reason: z.string().min(1, '사유를 입력해주세요').max(100, '사유는 100자 이하이어야 합니다'),
});

export const getClinicClosuresQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

- [ ] **Step 2: 타입 export 추가** (`schema.ts` Type Exports 블록, Holiday 타입 아래)

```ts
export type CreateClinicClosureRequest = z.infer<typeof createClinicClosureSchema>;
export type GetClinicClosuresQuery = z.infer<typeof getClinicClosuresQuerySchema>;
```

- [ ] **Step 3: `ClinicClosureItem` 인터페이스 추가** (`schema.ts`, `HolidayItem` 아래)

```ts
export interface ClinicClosureItem {
  id: string;
  date: string;
  reason: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: `DailyStatsItem`에 `is_clinic_closure` 추가** (`schema.ts:306` 인터페이스)

```ts
export interface DailyStatsItem {
  id: string;
  date: string;
  scheduled_count: number;
  attendance_count: number;
  consultation_count: number;
  registered_count: number;
  attendance_rate: number | null;
  consultation_rate: number | null;
  consultation_rate_vs_attendance: number | null;
  calculated_at: string;
  is_holiday: boolean;
  holiday_reason?: string;
  is_weekend: boolean;
  is_clinic_closure: boolean;
}
```

- [ ] **Step 5: 에러 코드 추가** (`error.ts`, HOLIDAY_ 코드 아래)

```ts
  CLINIC_CLOSURE_FETCH_FAILED = 'CLINIC_CLOSURE_FETCH_FAILED',
  CLINIC_CLOSURE_CREATE_FAILED = 'CLINIC_CLOSURE_CREATE_FAILED',
  CLINIC_CLOSURE_DELETE_FAILED = 'CLINIC_CLOSURE_DELETE_FAILED',
  CLINIC_CLOSURE_ALREADY_EXISTS = 'CLINIC_CLOSURE_ALREADY_EXISTS',
```

- [ ] **Step 6: 타입 체크 & 커밋**

```bash
npx tsc --noEmit
git add src/features/admin/backend/schema.ts src/features/admin/backend/error.ts
git commit -m "feat(admin): 휴진일 스키마·타입·에러코드 추가"
```

> 주의: Step 4 이후 `getDailyStats` 반환 객체가 `is_clinic_closure`를 누락하면 `tsc` 에러가 난다. Task 7에서 채운다. 이 커밋만으로 tsc가 실패하면 Task 7과 묶어 커밋한다.

---

## Task 3: 휴진일 날짜 집합 헬퍼

**Files:**
- Modify: `src/lib/business-days.ts`

**Interfaces:**
- Produces: `getClinicClosureDatesSet(supabase, startDate, endDate): Promise<Set<string>>`

- [ ] **Step 1: 헬퍼 추가** (`business-days.ts` 끝에)

```ts
/**
 * 기간 내 휴진일(진찰 없는 날) 날짜를 Set<yyyy-MM-dd>으로 반환합니다.
 * 공휴일과 달리 출석 지표에는 영향을 주지 않고 진찰 지표에서만 제외하는 용도.
 */
export async function getClinicClosureDatesSet(
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string,
): Promise<Set<string>> {
  const { data } = await supabase.from('clinic_closures')
    .select('date')
    .gte('date', startDate)
    .lte('date', endDate);

  return new Set((data || []).map((r) => r.date));
}
```

- [ ] **Step 2: 타입 체크 & 커밋**

```bash
npx tsc --noEmit
git add src/lib/business-days.ts
git commit -m "feat(lib): 휴진일 날짜 집합 조회 헬퍼 추가"
```

---

## Task 4: 휴진일 CRUD 서비스 + 헬퍼 재노출

**Files:**
- Modify: `src/features/admin/backend/service.ts`

**Interfaces:**
- Consumes: `getClinicClosureDatesSet` (Task 3), `ClinicClosureItem`/요청 타입 (Task 2), `AdminErrorCode.CLINIC_CLOSURE_*` (Task 2)
- Produces: `getClinicClosures`, `createClinicClosure`, `deleteClinicClosure`, 그리고 파일 내부용 `getClinicClosureDatesSet` 재노출 상수

- [ ] **Step 1: import 추가** (`service.ts:7` — 기존 별칭 형태 유지, `getClinicClosureDatesSet`만 추가)

실제 `service.ts:7`은 `import { isWeekend as isWeekendUtil, getHolidayDatesMap as getHolidayDatesMapUtil } from '@/lib/business-days';`이고 `:853`에 `const isWeekend = isWeekendUtil` 로컬 별칭이 있다. **`isWeekend`를 별칭 없이 재import하면 식별자 충돌**이므로, 기존 별칭 형태를 유지하고 항목만 추가한다:

```ts
import {
  isWeekend as isWeekendUtil,
  getHolidayDatesMap as getHolidayDatesMapUtil,
  getClinicClosureDatesSet as getClinicClosureDatesSetUtil,
} from '@/lib/business-days';
```

그리고 타입 import에 `ClinicClosureItem`, `CreateClinicClosureRequest`, `GetClinicClosuresQuery` 추가.

- [ ] **Step 2: 헬퍼 재노출** (`service.ts`의 `getHolidayDatesMap` 로컬 래퍼 바로 아래)

```ts
const getClinicClosureDatesSet = (
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string,
): Promise<Set<string>> => getClinicClosureDatesSetUtil(supabase as SupabaseClient, startDate, endDate);
```

- [ ] **Step 3: CRUD 함수 추가** (`deleteHoliday` 아래, Holiday CRUD 블록과 대칭)

```ts
// ========== Clinic Closure CRUD ==========

export async function getClinicClosures(
  supabase: SupabaseClient<Database>,
  query: GetClinicClosuresQuery,
): Promise<ClinicClosureItem[]> {
  const { data, error } = await supabase
    .from('clinic_closures')
    .select('*')
    .gte('date', query.start_date)
    .lte('date', query.end_date)
    .order('date');

  if (error) {
    throw new AdminError(
      AdminErrorCode.CLINIC_CLOSURE_FETCH_FAILED,
      `휴진일 조회 실패: ${error.message}`,
    );
  }

  return (data || []) as ClinicClosureItem[];
}

export async function createClinicClosure(
  supabase: SupabaseClient<Database>,
  request: CreateClinicClosureRequest,
): Promise<ClinicClosureItem> {
  const { data, error } = await supabase
    .from('clinic_closures')
    .insert({ date: request.date, reason: request.reason })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AdminError(
        AdminErrorCode.CLINIC_CLOSURE_ALREADY_EXISTS,
        '이미 등록된 휴진일입니다',
      );
    }
    throw new AdminError(
      AdminErrorCode.CLINIC_CLOSURE_CREATE_FAILED,
      `휴진일 등록 실패: ${error.message}`,
    );
  }

  return data as ClinicClosureItem;
}

export async function deleteClinicClosure(
  supabase: SupabaseClient<Database>,
  closureId: string,
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('clinic_closures')
    .delete()
    .eq('id', closureId);

  if (error) {
    throw new AdminError(
      AdminErrorCode.CLINIC_CLOSURE_DELETE_FAILED,
      `휴진일 삭제 실패: ${error.message}`,
    );
  }

  return { success: true };
}
```

- [ ] **Step 4: 타입 체크 & 커밋**

```bash
npx tsc --noEmit
git add src/features/admin/backend/service.ts
git commit -m "feat(admin): 휴진일 CRUD 서비스·헬퍼 재노출 추가"
```

> `clinic_closures`의 `Database` 타입 정의는 Task 1 Step 2에서 이미 추가됨 → 여기서는 불필요.

---

## Task 5: 휴진일 라우트

**Files:**
- Modify: `src/features/admin/backend/route.ts`

**Interfaces:**
- Consumes: Task 2 스키마, Task 4 서비스
- Produces: `GET/POST /api/admin/clinic-closures`, `DELETE /api/admin/clinic-closures/:id`

- [ ] **Step 1: import 추가** (route.ts 상단 — service/schema import에 추가)

```ts
// service import에:
getClinicClosures, createClinicClosure, deleteClinicClosure,
// schema import에:
getClinicClosuresQuerySchema, createClinicClosureSchema,
```

- [ ] **Step 2: 라우트 추가** (Holidays Routes 블록 아래, Holiday 라우트와 대칭)

```ts
// ========== Clinic Closures Routes ==========

adminRoutes.get('/clinic-closures', async (c) => {
  const supabase = c.get('supabase');
  const query = {
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
  };
  try {
    const params = getClinicClosuresQuerySchema.parse(query);
    const result = await getClinicClosures(supabase, params);
    return respond(c, success({ data: result }, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

adminRoutes.post('/clinic-closures', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();
  try {
    const request = createClinicClosureSchema.parse(body);
    const result = await createClinicClosure(supabase, request);
    return respond(c, success(result, 201));
  } catch (error) {
    if (error instanceof AdminError) {
      if (error.code === 'CLINIC_CLOSURE_ALREADY_EXISTS') {
        return respond(c, failure(409, error.code, error.message));
      }
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

adminRoutes.delete('/clinic-closures/:id', async (c) => {
  const supabase = c.get('supabase');
  const closureId = c.req.param('id');
  try {
    const result = await deleteClinicClosure(supabase, closureId);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});
```

- [ ] **Step 3: 타입 체크 & 커밋**

```bash
npx tsc --noEmit
git add src/features/admin/backend/route.ts
git commit -m "feat(admin): 휴진일 CRUD 라우트 추가"
```

---

## Task 6: `aggregateStats` 휴진일 제외 + 진찰률 분모 분리 (핵심)

**Files:**
- Modify: `src/features/admin/backend/service.ts` (`aggregateStats` `:882~926`, `StatsAggregate` `:855`, 평균 산출 `:1348~1356`, `getStatsSummary` 호출부 `:1338~1349`)
- Test: `src/features/admin/backend/aggregate-stats.test.ts` (신규)

**Interfaces:**
- Consumes: `getClinicClosureDatesSet` (Task 4)
- Produces: `export function aggregateStats(rows, holidayMap, closureSet)` — 시그니처에 `closureSet: Set<string>` 추가. `StatsAggregate`에 `consultationRateDays: number` 추가.

**핵심 규칙:**
- 출석률(`attendanceRateSum`/`attendanceDays`): 휴진일 **포함** (변경 없음).
- 진찰률(`consultationRateSum`): 휴진일 **제외**, 별도 분모 `consultationRateDays`로 나눈다.
- 진찰 참석률(`consultationRateVsAttendanceSum`/`consultationDays`): 평일 AND 휴진일 아닌 날만.
- **`totalConsultation`(총 진찰 건수) 방침**: 휴진일 판정 이전에 누적되는 **원시 합계**이므로 그대로 둔다(변경 없음). 휴진일에는 진찰 기록이 0건이라 실질 영향이 없고, 이 값은 rate가 아닌 단순 카운트라 "진찰 지표 왜곡" 대상이 아니다. (Codex 2차 지적 4 반영 — 방침 명시.)

- [ ] **Step 1: 실패 테스트 작성** (`aggregate-stats.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { aggregateStats } from './service';

type Row = Parameters<typeof aggregateStats>[0][number];

function row(overrides: Partial<Row> & { date: string }): Row {
  return {
    date: overrides.date,
    scheduled_count: 10,
    attendance_count: 10,
    consultation_count: 8,
    attendance_rate: 100,
    consultation_rate: 80,
    consultation_rate_vs_attendance: 80,
    ...overrides,
  } as Row;
}

describe('aggregateStats 휴진일 처리', () => {
  // 2026-07-06(월)~07-08(수)은 평일. 07-08을 휴진일로 지정.
  const rows = [
    row({ date: '2026-07-06', consultation_rate: 90, consultation_rate_vs_attendance: 90 }),
    row({ date: '2026-07-07', consultation_rate: 90, consultation_rate_vs_attendance: 90 }),
    row({ date: '2026-07-08', consultation_rate: 0, consultation_rate_vs_attendance: 0, consultation_count: 0 }),
  ];
  const noHolidays = new Map<string, string>();

  it('휴진일 없으면 진찰 참석률 평균은 (90+90+0)/3 = 60', () => {
    const agg = aggregateStats(rows, noHolidays, new Set());
    expect(agg.consultationDays).toBe(3);
    expect(agg.consultationRateVsAttendanceSum / agg.consultationDays).toBeCloseTo(60);
  });

  it('07-08 휴진일이면 진찰 참석률 평균은 (90+90)/2 = 90', () => {
    const agg = aggregateStats(rows, noHolidays, new Set(['2026-07-08']));
    expect(agg.consultationDays).toBe(2);
    expect(agg.consultationRateVsAttendanceSum / agg.consultationDays).toBeCloseTo(90);
  });

  it('휴진일은 진찰률(예정대비) 분모에서도 빠져 평균 왜곡 없음', () => {
    const agg = aggregateStats(rows, noHolidays, new Set(['2026-07-08']));
    expect(agg.consultationRateDays).toBe(2);
    expect(agg.consultationRateSum / agg.consultationRateDays).toBeCloseTo(90);
  });

  it('출석률 분모(attendanceDays)에는 휴진일이 그대로 포함', () => {
    const agg = aggregateStats(rows, noHolidays, new Set(['2026-07-08']));
    expect(agg.attendanceDays).toBe(3);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/admin/backend/aggregate-stats.test.ts`
Expected: FAIL (`aggregateStats` not exported / `consultationRateDays` undefined)

- [ ] **Step 3: `StatsAggregate` 인터페이스에 필드 추가** (`service.ts:855`)

`consultationRateSum` 아래에:
```ts
  consultationRateDays: number;
```

- [ ] **Step 4: `aggregateStats` export + 시그니처 + 로직 변경** (`service.ts:882`)

```ts
export function aggregateStats(
  rows: DailyStatsForAggregate[],
  holidayMap: Map<string, string>,
  closureSet: Set<string>,
): StatsAggregate {
  const acc: StatsAggregate = {
    totalScheduled: 0,
    totalAttendance: 0,
    totalConsultation: 0,
    attendanceRateSum: 0,
    consultationRateSum: 0,
    consultationRateDays: 0,
    attendanceDays: 0,
    consultationRateVsAttendanceSum: 0,
    consultationDays: 0,
    excludedHolidays: 0,
    excludedWeekends: 0,
  };

  for (const s of rows) {
    acc.totalScheduled += s.scheduled_count;
    acc.totalAttendance += s.attendance_count;
    acc.totalConsultation += s.consultation_count;

    if (s.attendance_rate === null) continue;

    const holiday = holidayMap.has(s.date);
    const weekend = isWeekend(s.date);
    const closure = closureSet.has(s.date);

    if (holiday) {
      acc.excludedHolidays++;
      continue;
    }

    // 공휴일이 아닌 날: 출석률은 항상 집계 (주말·휴진일 포함)
    acc.attendanceRateSum += Math.min(s.attendance_rate || 0, 100);
    acc.attendanceDays++;

    // 진찰률(예정 대비): 휴진일 제외, 별도 분모
    if (!closure) {
      acc.consultationRateSum += Math.min(s.consultation_rate || 0, 100);
      acc.consultationRateDays++;
    }

    if (weekend) {
      acc.excludedWeekends++;
    } else if (!closure) {
      // 평일 & 휴진일 아님: 진찰 참석률 집계
      acc.consultationRateVsAttendanceSum += Math.min(s.consultation_rate_vs_attendance || 0, 100);
      acc.consultationDays++;
    }
  }

  return acc;
}
```

- [ ] **Step 5: 평균 산출부 수정** (`service.ts:1350~1356`)

`average_consultation_rate` 계산을 분모 분리로 교체:
```ts
    average_attendance_rate: periodAgg.attendanceDays > 0
      ? periodAgg.attendanceRateSum / periodAgg.attendanceDays : 0,
    average_consultation_rate: periodAgg.consultationRateDays > 0
      ? periodAgg.consultationRateSum / periodAgg.consultationRateDays : 0,
    average_consultation_rate_vs_attendance: periodAgg.consultationDays > 0
      ? periodAgg.consultationRateVsAttendanceSum / periodAgg.consultationDays : 0,
```

- [ ] **Step 6: `getStatsSummary` 호출부 수정** (`service.ts` Promise.all에 휴진일 조회 추가, aggregateStats 호출에 전달)

Promise.all 배열(`:1338` 부근, `getHolidayDatesMap(...)` 2개 뒤)에 추가:
```ts
    getClinicClosureDatesSet(supabase, query.start_date, query.end_date),
    getClinicClosureDatesSet(supabase, prevStartDate, prevEndDate),
```
구조분해에 `closures`, `prevClosures` 추가하고 호출 변경:
```ts
  const periodAgg = aggregateStats(periodStatsRaw ?? [], holidays, closures);
  const prevAgg = aggregateStats(prevStatsRaw ?? [], prevHolidays, prevClosures);
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npx vitest run src/features/admin/backend/aggregate-stats.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 8: 타입 체크 & 커밋**

```bash
npx tsc --noEmit
git add src/features/admin/backend/service.ts src/features/admin/backend/aggregate-stats.test.ts
git commit -m "feat(admin): 기간 통계에서 휴진일 진찰 지표 제외·진찰률 분모 분리"
```

---

## Task 7: `getDailyStats`/`calculateDailyStats`에 `is_clinic_closure` 플래그

**Files:**
- Modify: `src/features/admin/backend/service.ts` (`getDailyStats` `:1385~1409`, `calculateDailyStats` 반환 `:843~847`)

**Interfaces:**
- Consumes: `getClinicClosureDatesSet` (Task 4)
- Produces: `getDailyStats`·`calculateDailyStats` 반환 객체에 `is_clinic_closure` 포함

- [ ] **Step 1: Promise.all에 휴진일 조회 추가** (`:1385`)

```ts
  const [{ data, error }, holidays, closures] = await Promise.all([
    supabase
      .from('daily_stats')
      .select('*')
      .gte('date', query.start_date)
      .lte('date', query.end_date)
      .order('date')
      .returns<DailyStatsRow[]>(),
    getHolidayDatesMap(supabase, query.start_date, query.end_date),
    getClinicClosureDatesSet(supabase, query.start_date, query.end_date),
  ]);
```

- [ ] **Step 2: 반환 매핑에 플래그 추가** (`:1403`)

```ts
  return (data || []).map((row) => ({
    ...row,
    is_holiday: holidays.has(row.date),
    holiday_reason: holidays.get(row.date) || undefined,
    is_weekend: isWeekend(row.date),
    is_clinic_closure: closures.has(row.date),
  }));
```

- [ ] **Step 3: `calculateDailyStats` 반환에도 필드 추가** (`:843~847`)

`calculateDailyStats`는 `{...data, is_holiday: false, is_weekend: false} as DailyStatsItem`로 끝난다. `as` 캐스팅이라 tsc가 누락을 못 잡지만 런타임에 `is_clinic_closure`가 `undefined`로 흐른다. 명시적으로 추가:
```ts
  return {
    ...data,
    is_holiday: false,
    is_weekend: false,
    is_clinic_closure: false,
  } as DailyStatsItem;
```
(이 함수는 daily_stats 배치 계산용이며 플래그를 저장하지 않으므로 `false` 고정으로 충분. 조회 시 실제 값은 `getDailyStats`가 부여.)

- [ ] **Step 4: 타입 체크 & 커밋**

```bash
npx tsc --noEmit
git add src/features/admin/backend/service.ts
git commit -m "feat(admin): 일별 통계에 휴진일 플래그(is_clinic_closure) 추가"
```

---

## Task 8: 월간 리포트 진찰 계산기 휴진일 제외

**Files:**
- Modify: `src/features/monthly-report/backend/calculators/consultation.ts`
- Modify: `src/features/monthly-report/backend/service.ts` (`:169~170` 호출부)

**Interfaces:**
- Consumes: `clinic_closures` 테이블
- Produces: `calculateConsultationStats(supabase, year, month)` / `calculateConsultationAttendanceRate(supabase, year, month)` — 내부에서 휴진일 count를 차감(시그니처 불변).

**전략:** 월 범위 count 쿼리는 그대로 두고, 같은 범위의 **휴진일 날짜에 해당하는 count**를 `.in('date', closureDates)`로 별도 조회해 차감한다. 휴진일이 없으면(빈 배열) 차감 0 → 동작 불변.

- [ ] **Step 1: 휴진일 날짜 조회 헬퍼 (파일 내부)** (`consultation.ts` 상단, import 아래)

테이블별로 분리하고 `error`를 throw한다(union 제네릭 추론 붕괴·조용한 실패 방지 — Codex 2차 지적 6).

```ts
async function getMonthClosureDates(
  supabase: Supabase,
  monthStart: string,
  nextMonth: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('clinic_closures')
    .select('date')
    .gte('date', monthStart)
    .lt('date', nextMonth);
  if (error) throw new Error(`휴진일 조회 실패: ${error.message}`);
  return (data || []).map((r) => r.date);
}

async function countScheduledInDates(supabase: Supabase, dates: string[]): Promise<number> {
  if (dates.length === 0) return 0;
  const { count, error } = await supabase
    .from('scheduled_attendances')
    .select('*', { count: 'exact', head: true })
    .in('date', dates)
    .eq('is_cancelled', false);
  if (error) throw new Error(`휴진일 예정 출석 조회 실패: ${error.message}`);
  return count ?? 0;
}

async function countConsultationsInDates(supabase: Supabase, dates: string[]): Promise<number> {
  if (dates.length === 0) return 0;
  const { count, error } = await supabase
    .from('consultations')
    .select('*', { count: 'exact', head: true })
    .in('date', dates);
  if (error) throw new Error(`휴진일 진찰 조회 실패: ${error.message}`);
  return count ?? 0;
}

async function countAttendancesInDates(supabase: Supabase, dates: string[]): Promise<number> {
  if (dates.length === 0) return 0;
  const { count, error } = await supabase
    .from('attendances')
    .select('*', { count: 'exact', head: true })
    .in('date', dates);
  if (error) throw new Error(`휴진일 출석 조회 실패: ${error.message}`);
  return count ?? 0;
}
```

- [ ] **Step 2: `calculateConsultationStats`에서 차감 적용** (기존 세 count 조회 뒤, `scheduled`/`performed`/`attended` 상수 계산 직전/직후)

기존:
```ts
  const scheduled = scheduledCount ?? 0;
  const performed = performedCount ?? 0;
  const attended = attendanceCount ?? 0;
```
로 바꾼다:
```ts
  const closureDates = await getMonthClosureDates(supabase, monthStart, nextMonth);
  const [closureScheduled, closurePerformed, closureAttended] = await Promise.all([
    countScheduledInDates(supabase, closureDates),
    countConsultationsInDates(supabase, closureDates),
    countAttendancesInDates(supabase, closureDates),
  ]);

  const scheduled = Math.max(0, (scheduledCount ?? 0) - closureScheduled);
  const performed = Math.max(0, (performedCount ?? 0) - closurePerformed);
  const attended = Math.max(0, (attendanceCount ?? 0) - closureAttended);
```
(이후 `missed`/`missedByAbsent`/`missedByOther` 로직은 그대로 — 휴진일 제외된 값으로 계산됨.)

- [ ] **Step 3: `calculateConsultationAttendanceRate`에서 차감 적용** (두 count 뒤)

기존:
```ts
  const attended = attendanceCount ?? 0;
  const consulted = consultationCount ?? 0;
```
로 바꾼다:
```ts
  const closureDates = await getMonthClosureDates(supabase, monthStart, nextMonth);
  const [closureAttended, closureConsulted] = await Promise.all([
    countAttendancesInDates(supabase, closureDates),
    countConsultationsInDates(supabase, closureDates),
  ]);
  const attended = Math.max(0, (attendanceCount ?? 0) - closureAttended);
  const consulted = Math.max(0, (consultationCount ?? 0) - closureConsulted);
```

- [ ] **Step 4: 타입 체크 & 커밋** (`monthly-report/backend/service.ts` 호출부는 시그니처 불변이라 수정 없음 — 확인만)

```bash
npx tsc --noEmit
git add src/features/monthly-report/backend/calculators/consultation.ts
git commit -m "feat(monthly-report): 진찰 통계에서 휴진일 제외"
```

---

## Task 8B: 월간 리포트 코디네이터별 진찰 참석률 휴진일 제외 (Codex 2차 지적 1)

**Files:**
- Modify: `src/features/monthly-report/backend/calculators/coordinator.ts` (`calculateCoordinatorPerformance` `:50~`, 진찰 참석률 계산 `:191~206`)

**Interfaces:**
- Consumes: `clinic_closures` 테이블
- Produces: `calculateCoordinatorPerformance(supabase, year, month)` — 시그니처 불변. 코디별 `consultation_attendance_rate`에서만 휴진일 제외(출석률 `avg_attendance_rate`·연속결석은 불변).

**배경:** `coordinator.ts`는 월간 진찰 데이터를 환자별 Set으로 모아, 코디별로 `consultationRate = consultedDays / attendedDays`(`:202~204`)를 계산한다. 휴진일에는 consultedDays만 0이 되어 코디 진찰 참석률이 왜곡된다. 진찰 참석률 계산에서만 휴진일 날짜를 attended/consulted 양쪽에서 빼면 된다.

- [ ] **Step 1: 휴진일 날짜 Set 조회** (진찰 데이터 조회 블록 `:118~130` 뒤에 추가)

```ts
  // 해당 월 휴진일 (진찰 참석률 계산에서만 제외)
  const { data: closureRows, error: closureErr } = await supabase
    .from('clinic_closures')
    .select('date')
    .gte('date', monthStartStr)
    .lte('date', monthEndStr);
  if (closureErr) throw new Error(`휴진일 조회 실패: ${closureErr.message}`);
  const closureSet = new Set<string>((closureRows ?? []).map((r) => r.date));
```

- [ ] **Step 2: 진찰 참석률 계산에서 휴진일 제외** (`:191~206` 루프 내부)

기존:
```ts
      const possibleDays = scheduledSet.size;
      const attendedDays = attended.size;
      const consultedDays = consulted.size;
```
아래에 휴진일 제외 변수 추가:
```ts
      const attendedDaysForConsult = [...attended].filter((d) => !closureSet.has(d)).length;
      const consultedDaysForConsult = [...consulted].filter((d) => !closureSet.has(d)).length;
```
그리고 진찰 참석률 계산만 새 변수로 교체(출석률은 기존 `attendedDays`/`possibleDays` 그대로):
```ts
      // 진찰 참석률 (출석 대비) — 휴진일 제외
      const consultationRate =
        attendedDaysForConsult > 0
          ? Math.min((consultedDaysForConsult / attendedDaysForConsult) * 100, 100)
          : 0;
      totalConsultationRate += consultationRate;
```

- [ ] **Step 3: 타입 체크 & 커밋**

```bash
npx tsc --noEmit
git add src/features/monthly-report/backend/calculators/coordinator.ts
git commit -m "feat(monthly-report): 코디네이터별 진찰 참석률에서 휴진일 제외"
```

---

## Task 9: 오늘 하이라이트 `examMissed` 억제

**Files:**
- Modify: `src/features/highlights/backend/service.ts` (`:137` 부근, `computeTodayHighlights`)
- Test: `src/features/highlights/backend/service.test.ts` (기존 확장)

**Interfaces:**
- Consumes: `clinic_closures` 테이블
- Produces: 오늘이 휴진일이면 `events.examMissed`는 항상 빈 배열.

- [ ] **Step 1: 실패 테스트 추가** (`service.test.ts`의 mock에 `clinic_closures` 테이블 지원 + 케이스)

`mockSupabase`의 `select` 반환 객체에 `in`/추가 체인이 필요하면 보강한다. 최소: `clinic_closures` 테이블도 `gte().lte()` 체인으로 조회하므로 기존 mock으로 커버됨. 테스트:
```ts
it('오늘이 휴진일이면 examMissed는 비어있다', async () => {
  const supabase = mockSupabase({
    patients: [
      { id: 'p1', name: '홍길동', birth_date: null, display_name: null, avatar_url: null, room_number: '3101', status: 'active', created_at: '2025-01-01T00:00:00Z' },
    ],
    attendances: [{ patient_id: 'p1', date: '2026-04-13' }],
    scheduled_attendances: [{ patient_id: 'p1', date: '2026-04-13', is_cancelled: false }],
    consultations: [],
    clinic_closures: [{ date: '2026-04-13' }],
  });
  // 2026-04-13(월) 15시 KST = 정오 이후
  const result = await computeTodayHighlights(supabase as never, new Date('2026-04-13T06:00:00Z'));
  expect(result.events.examMissed).toEqual([]);
});
```
(정오 이전이면 어차피 examMissed가 비므로, 정오 이후 시각으로 설정할 것.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/highlights/backend/service.test.ts`
Expected: FAIL

- [ ] **Step 3: 휴진일 조회 + 억제 로직 추가** (`computeTodayHighlights`)

환자/출결 조회 Promise.all 뒤에 오늘 휴진일 여부 조회 추가:
```ts
  const { data: closureRows } = await supabase
    .from('clinic_closures')
    .select('date')
    .eq('date', todayStr);
  const isClinicClosureToday = (closureRows || []).length > 0;
```
그리고 `examMissed.push` 조건에 `!isClinicClosureToday` 추가 (`:137`):
```ts
      if (!isClinicClosureToday && attendanceTodaySet.has(p.id) && !consultationTodaySet.has(p.id)) {
        examMissed.push(toHighlightPatient(p));
      }
```

- [ ] **Step 4: 테스트 통과 & 커밋**

```bash
npx vitest run src/features/highlights/backend/service.test.ts
npx tsc --noEmit
git add src/features/highlights/backend/service.ts src/features/highlights/backend/service.test.ts
git commit -m "feat(highlights): 휴진일에는 진찰 누락 카드(examMissed) 억제"
```

> mock의 `select().eq()`가 `clinic_closures`에서 `{data}`를 반환하도록, 기존 `mockSupabase`의 `eq: () => terminal` 경로가 `data`를 주는지 확인. 부족하면 mock에 `eq: () => ({ data: rows, error: null })` 보강.

---

## Task 10: 슬랙 정오 리포트 composer `clinicClosed` 옵션

**Files:**
- Modify: `src/server/services/noon-report.ts`
- Test: `src/server/services/noon-report.test.ts` (기존 확장)

**Interfaces:**
- Produces: `composeNoonReportMessage(board, dateLabel, options?: { clinicClosed?: boolean }): string`
  - `clinicClosed`면: 요약줄에서 `· 진찰 c/y` 생략, "출석 후 미진찰" 섹션 생략, "전원 출석·진찰 완료" 대신 "전원 출석"(미출석 0명일 때). 미출석 명단은 유지.

- [ ] **Step 1: 실패 테스트 추가** (`noon-report.test.ts`)

```ts
it('clinicClosed면 미진찰 섹션과 진찰 요약을 생략한다', () => {
  const board = makeBoard([
    makePatient({ id: 'a', status: 'attended', is_consulted: false }),
    makePatient({ id: 'b', status: 'attended', is_consulted: false }),
  ]);
  const msg = composeNoonReportMessage(board, '7월 6일 (월)', { clinicClosed: true });
  expect(msg).not.toContain('미진찰');
  expect(msg).not.toContain('진찰 ');
  expect(msg).toContain('휴진');
});

it('clinicClosed여도 미출석 명단은 발송한다', () => {
  const board = makeBoard([
    makePatient({ id: 'a', status: 'absent', is_attended: false, is_consulted: false, name: '김결석' }),
    makePatient({ id: 'b', status: 'attended', is_consulted: false }),
  ]);
  const msg = composeNoonReportMessage(board, '7월 6일 (월)', { clinicClosed: true });
  expect(msg).toContain('미출석');
  expect(msg).toContain('김결석');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/server/services/noon-report.test.ts`
Expected: FAIL

- [ ] **Step 3: composer 수정**

```ts
export function composeNoonReportMessage(
  board: AttendanceBoardResponse,
  dateLabel: string,
  options?: { clinicClosed?: boolean },
): string {
  const clinicClosed = options?.clinicClosed ?? false;
  const allPatients = board.rooms.flatMap((room) => room.patients);

  const absentPatients = allPatients.filter((p) => p.status === ABSENT_STATUS);
  const attendedNotConsultedPatients = allPatients.filter(
    (p) => p.status === ATTENDED_STATUS,
  );

  const attendedCount = board.total_attended;
  const scheduledCount = board.total_scheduled;
  const consultedCount = board.total_consulted;

  const headerLine = `\u{1F3E5} 낮병원 정오 현황 — ${dateLabel}`;
  const summaryLine = clinicClosed
    ? `출석 ${attendedCount}/${scheduledCount} · 휴진일(진찰 없음)`
    : `출석 ${attendedCount}/${scheduledCount} · 진찰 ${consultedCount}/${attendedCount}`;

  const lines: string[] = [headerLine, summaryLine];

  if (absentPatients.length === 0 && (clinicClosed || attendedNotConsultedPatients.length === 0)) {
    lines.push('');
    lines.push(clinicClosed ? '\u{1F389} 전원 출석' : '\u{1F389} 전원 출석·진찰 완료');
    return lines.join('\n');
  }

  if (absentPatients.length > 0) {
    lines.push('');
    lines.push(`❌ 미출석 (${absentPatients.length}명)`);
    lines.push(absentPatients.map(formatPatientLabel).join(', '));
  }

  if (!clinicClosed && attendedNotConsultedPatients.length > 0) {
    lines.push('');
    lines.push(`\u{1FA7A} 출석 후 미진찰 (${attendedNotConsultedPatients.length}명)`);
    lines.push(attendedNotConsultedPatients.map(formatPatientLabel).join(', '));
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: 테스트 통과 & 커밋**

```bash
npx vitest run src/server/services/noon-report.test.ts
git add src/server/services/noon-report.ts src/server/services/noon-report.test.ts
git commit -m "feat(slack): 정오 리포트에 휴진일 옵션(미진찰 생략) 추가"
```

---

## Task 11: 정오 리포트 라우트 — 휴진일 감지·전달

**Files:**
- Modify: `src/app/api/internal/cron/noon-attendance-report/route.ts`

**Interfaces:**
- Consumes: `getClinicClosureDatesSet` (Task 3), `composeNoonReportMessage` 옵션 (Task 10)

- [ ] **Step 1: import 추가**

```ts
import { isWeekend, getHolidayDatesMap, getClinicClosureDatesSet } from '@/lib/business-days';
```

- [ ] **Step 2: 휴진일 감지 (공휴일 skip 블록 뒤, 보드 조회 전)**

```ts
  const closureSet = await getClinicClosureDatesSet(supabase, todayStr, todayStr);
  const isClinicClosed = closureSet.has(todayStr);
```

- [ ] **Step 3: composer 호출에 옵션 전달**

```ts
  const messageText = composeNoonReportMessage(board, dateLabel, { clinicClosed: isClinicClosed });
```

- [ ] **Step 4: 응답에 플래그 포함(선택) & 타입 체크·커밋**

응답 객체에 `clinic_closed: isClinicClosed` 추가(관측용).
```bash
npx tsc --noEmit
git add src/app/api/internal/cron/noon-attendance-report/route.ts
git commit -m "feat(slack): 정오 리포트 라우트에서 휴진일 감지·전달"
```

---

## Task 12: 요일별 통계 휴진일 제외

**Files:**
- Modify: `src/features/shared/lib/stats.ts` (`calculateDayOfWeekStats`)
- Test: `src/features/shared/lib/stats.test.ts` (신규)

**Interfaces:**
- Consumes: `DailyStatsItem.is_clinic_closure` (Task 2)
- Produces: 진찰 평균(`avg_consultation`, `avg_consultation_rate_vs_attendance`)은 휴진일 제외·별도 분모. 출석 평균은 전체 유지.

- [ ] **Step 1: 실패 테스트 작성** (`stats.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { calculateDayOfWeekStats } from './stats';
import type { DailyStatsItem } from '@/features/admin/backend/schema';

function item(o: Partial<DailyStatsItem> & { date: string }): DailyStatsItem {
  return {
    id: o.date, date: o.date, scheduled_count: 10, attendance_count: 10,
    consultation_count: 8, registered_count: 10, attendance_rate: 100,
    consultation_rate: 80, consultation_rate_vs_attendance: 80,
    calculated_at: '', is_holiday: false, is_weekend: false,
    is_clinic_closure: false, ...o,
  };
}

describe('calculateDayOfWeekStats 휴진일 처리', () => {
  // 두 개의 월요일: 하나는 정상(90%), 하나는 휴진(0%)
  const stats = [
    item({ date: '2026-07-06', consultation_rate_vs_attendance: 90 }),
    item({ date: '2026-07-13', consultation_rate_vs_attendance: 0, consultation_count: 0, is_clinic_closure: true }),
  ];

  it('휴진일은 진찰 참석률 요일 평균에서 제외 → 월요일 평균 90', () => {
    const result = calculateDayOfWeekStats(stats);
    const mon = result.find((r) => r.day_of_week === 1)!;
    expect(mon.avg_consultation_rate_vs_attendance).toBeCloseTo(90);
  });

  it('출석 평균에는 휴진일 포함 → data_count는 2', () => {
    const result = calculateDayOfWeekStats(stats);
    const mon = result.find((r) => r.day_of_week === 1)!;
    expect(mon.data_count).toBe(2);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/shared/lib/stats.test.ts`
Expected: FAIL

- [ ] **Step 3: 진찰 평균을 휴진일 제외 부분집합으로 계산** (`calculateDayOfWeekStats` 루프 내부)

`const count = items.length;` 아래에 진찰용 부분집합 추가:
```ts
    const consultItems = items.filter((i) => !i.is_clinic_closure);
    const consultCount = consultItems.length;
```
`avgConsultation`을 consultItems 기반으로:
```ts
    const avgConsultation = consultCount > 0
      ? consultItems.reduce((s, i) => s + i.consultation_count, 0) / consultCount
      : 0;
```
`avgConsultationRateVsAttendance`를 consultItems·consultCount 기반으로:
```ts
    const isWeekendDay = dow === 0 || dow === 6;
    const avgConsultationRateVsAttendance = isWeekendDay || consultCount === 0
      ? null
      : Math.round(
          (consultItems.reduce(
            (s, i) => s + Math.min(i.consultation_rate_vs_attendance || 0, 100), 0,
          ) / consultCount) * 10,
        ) / 10;
```
(`avgScheduled`/`avgAttendance`/`avgAttendanceRate`/`count`는 그대로 — 출석은 전체 유지.)

- [ ] **Step 4: 테스트 통과 & 커밋**

```bash
npx vitest run src/features/shared/lib/stats.test.ts
npx tsc --noEmit
git add src/features/shared/lib/stats.ts src/features/shared/lib/stats.test.ts
git commit -m "feat(stats): 요일별 통계에서 휴진일 진찰 평균 제외"
```

---

## Task 13: 추이 차트 `filterClosures` + 상세표 휴진일 표시

**Files:**
- Modify: `src/features/shared/components/stats/RateLineChart.tsx`
- Modify: `src/features/shared/components/stats/ConsultationRateChart.tsx`
- Modify: `src/features/shared/components/stats/StatsDetailTable.tsx`

**Interfaces:**
- Consumes: `DailyStatsItem.is_clinic_closure`
- Produces: `RateLineChart`에 `filterClosures?: boolean` prop. 진찰 차트만 true.

- [ ] **Step 1: `RateLineChart` prop 추가** (`:21` interface, `:33~43` 파라미터, `:44~48` rates, `:69` deps)

interface에:
```ts
  filterClosures?: boolean;
```
파라미터 기본값:
```ts
  filterWeekends = false,
  filterClosures = false,
```
`rates` 매핑:
```ts
    const rates = dailyStats.map((s) => {
      if (s.is_holiday) return null;
      if (filterWeekends && s.is_weekend) return null;
      if (filterClosures && s.is_clinic_closure) return null;
      return s[dataKey] as number | null;
    });
```
useMemo 의존성 배열에 `filterClosures` 추가.

- [ ] **Step 2: `ConsultationRateChart`에서 전달** (`:13~20` RateLineChart 사용부, `filterWeekends` 옆)

```tsx
      filterWeekends
      filterClosures
```

- [ ] **Step 3: `StatsDetailTable` 진찰 셀 휴진일 표시** (`:105~112`)

진찰 참석률 셀에 휴진일 분기만 추가한다. **기존 공휴일은 `'제외'` 표기를 그대로 유지**(Codex 2차 지적 7 — `'-'`로 바꾸면 회귀). 현재 코드:
```tsx
                      <TableCell className={`text-right ${stat.is_holiday || stat.is_weekend ? '' : getRateCellClass(stat.consultation_rate_vs_attendance, CONSULTATION_RATE_THRESHOLDS)}`}>
                        {stat.is_holiday
                          ? '제외'
                          : stat.is_weekend
                            ? '-'
                            : stat.consultation_rate_vs_attendance != null
                              ? `${stat.consultation_rate_vs_attendance.toFixed(1)}%`
                              : '-'}
                      </TableCell>
```
로 바꾼다:
```tsx
                      <TableCell className={`text-right ${stat.is_holiday || stat.is_weekend || stat.is_clinic_closure ? '' : getRateCellClass(stat.consultation_rate_vs_attendance, CONSULTATION_RATE_THRESHOLDS)}`}>
                        {stat.is_holiday
                          ? '제외'
                          : stat.is_clinic_closure
                            ? '휴진'
                            : stat.is_weekend
                              ? '-'
                              : stat.consultation_rate_vs_attendance != null
                                ? `${stat.consultation_rate_vs_attendance.toFixed(1)}%`
                                : '-'}
                      </TableCell>
```
(출석률 셀·rowClass는 변경하지 않음 — 휴진일 출석은 정상 표시.)

- [ ] **Step 4: 타입 체크 & 커밋**

```bash
npx tsc --noEmit
git add src/features/shared/components/stats/RateLineChart.tsx src/features/shared/components/stats/ConsultationRateChart.tsx src/features/shared/components/stats/StatsDetailTable.tsx
git commit -m "feat(stats): 진찰 추이 차트·상세표에서 휴진일 제외·표시"
```

---

## Task 14: React Query 훅 + 쿼리 키 + 무효화

**Files:**
- Modify: `src/features/admin/hooks/query-keys.ts`
- Create: `src/features/admin/hooks/useClinicClosures.ts`

**Interfaces:**
- Consumes: Task 5 라우트, Task 2 타입
- Produces: `useClinicClosures(query)`, `useCreateClinicClosure()`, `useDeleteClinicClosure()`
- 무효화 대상: 통계 쿼리 + **하이라이트 쿼리**(`['highlights','today']`).

- [ ] **Step 1: 쿼리 키 추가** (`query-keys.ts`의 `holidays` 아래)

```ts
  clinicClosures: {
    all: ['admin', 'clinic-closures'] as const,
    list: (filters?: object) => ['admin', 'clinic-closures', filters] as const,
  },
```

- [ ] **Step 2: 훅 작성** (`useClinicClosures.ts`, `useHolidays.ts`를 mirror + 하이라이트 무효화)

```ts
'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { adminKeys } from './query-keys';
import { sharedKeys } from '../../shared/hooks/query-keys';
import type {
  GetClinicClosuresQuery,
  ClinicClosureItem,
  CreateClinicClosureRequest,
} from '../backend/schema';

function invalidateClinicClosureRelatedQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: adminKeys.clinicClosures.all });
  queryClient.invalidateQueries({ queryKey: adminKeys.statsSummary.all });
  queryClient.invalidateQueries({ queryKey: adminKeys.dailyStats.all });
  queryClient.invalidateQueries({ queryKey: sharedKeys.statsSummary.all });
  queryClient.invalidateQueries({ queryKey: sharedKeys.dailyStats.all });
  queryClient.invalidateQueries({ queryKey: sharedKeys.dayOfWeekStats.all });
  queryClient.invalidateQueries({ queryKey: ['highlights', 'today'] });
}

export function useClinicClosures(query: GetClinicClosuresQuery) {
  return useQuery({
    queryKey: adminKeys.clinicClosures.list(query),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start_date', query.start_date);
      params.set('end_date', query.end_date);
      const response = await apiClient.get<{ data: ClinicClosureItem[] }>(
        `/api/admin/clinic-closures?${params.toString()}`,
      );
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateClinicClosure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateClinicClosureRequest) => {
      const response = await apiClient.post<ClinicClosureItem>('/api/admin/clinic-closures', data);
      return response.data;
    },
    onSuccess: () => invalidateClinicClosureRelatedQueries(queryClient),
  });
}

export function useDeleteClinicClosure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (closureId: string) => {
      const response = await apiClient.delete<{ success: boolean }>(`/api/admin/clinic-closures/${closureId}`);
      return response.data;
    },
    onSuccess: () => invalidateClinicClosureRelatedQueries(queryClient),
  });
}
```

- [ ] **Step 3: 타입 체크 & 커밋**

```bash
npx tsc --noEmit
git add src/features/admin/hooks/query-keys.ts src/features/admin/hooks/useClinicClosures.ts
git commit -m "feat(admin): 휴진일 React Query 훅·쿼리키 추가"
```

> `sharedKeys.dayOfWeekStats`가 없으면 `useHolidays.ts`가 참조하는 실제 키 목록에 맞춘다(`useHolidays.ts`와 동일 import 사용하므로 존재함).

---

## Task 15: 관리 다이얼로그 + 통계 페이지 진입점

**Files:**
- Create: `src/features/admin/components/ClinicClosureManageDialog.tsx`
- Modify: `src/app/dashboard/admin/stats/page.tsx`

**Interfaces:**
- Consumes: Task 14 훅
- Produces: `<ClinicClosureManageDialog />` — 목록 조회 + 날짜 하나 추가 + 삭제. `HolidayManageDialog`를 mirror.

- [ ] **Step 1: `HolidayManageDialog.tsx` 전체를 읽어 구조 파악** (버튼·Dialog·목록·추가 폼·삭제)

Run: `sed -n '1,310p' src/features/admin/components/HolidayManageDialog.tsx`

- [ ] **Step 2: `ClinicClosureManageDialog.tsx` 작성** — `HolidayManageDialog`와 동일 UX로:
  - import를 `useClinicClosures/useCreateClinicClosure/useDeleteClinicClosure`로 교체
  - 타입을 `ClinicClosureItem`으로 교체
  - 트리거 버튼 라벨 "휴진일 관리", Dialog 제목 "휴진일(진찰 없는 날) 관리"
  - 안내문 추가: "휴진일에는 출석은 집계되지만 진찰은 집계에서 제외됩니다. 이미 생성된 월간 리포트는 휴진일 변경 후 재생성해야 반영됩니다."
  - 기본 조회 기간은 `HolidayManageDialog`와 동일한 방식(현재 연도 범위 등) 재사용

(코드는 Step 1에서 읽은 `HolidayManageDialog` 내용을 기반으로 훅/문구만 치환. 라인 수가 많아 여기 전량 기재 대신 mirror 규칙을 따른다: 식별자 `holiday→clinicClosure`, `공휴일→휴진일`, 훅 3종 치환, 위 안내문 삽입.)

- [ ] **Step 3: 통계 페이지에 진입점 추가** (`stats/page.tsx:10` import, `:85` HolidayManageDialog 옆)

import 추가:
```tsx
import { ClinicClosureManageDialog } from '@/features/admin/components/ClinicClosureManageDialog';
```
`<HolidayManageDialog />` 아래 줄에:
```tsx
          <HolidayManageDialog />
          <ClinicClosureManageDialog />
```

- [ ] **Step 4: 타입 체크·린트 & 커밋**

```bash
npx tsc --noEmit && npx eslint src --quiet
git add src/features/admin/components/ClinicClosureManageDialog.tsx src/app/dashboard/admin/stats/page.tsx
git commit -m "feat(admin): 휴진일 관리 다이얼로그·통계 페이지 진입점 추가"
```

---

## Task 16: 전체 품질 게이트 + 마이그레이션 적용 위임

**Files:** (없음 — 검증/적용)

- [ ] **Step 1: 전체 품질 게이트**

```bash
npx tsc --noEmit
npx eslint src --quiet
npx vitest run
npm run build
```
Expected: 모두 통과.

- [ ] **Step 2: 한글 깨짐 점검** — 신규/수정 파일에 UTF-8 깨진 한글 없는지 확인.

- [ ] **Step 3: 마이그레이션 적용 (사용자 위임/MCP)** — Supabase MCP `apply_migration`(project_id `hgkhcbdixubimbraigen`)로 `20260702000001_create_clinic_closures_table.sql` 적용. 적용 전 `list_tables`로 `clinic_closures` 부재 확인, 적용 후 `SELECT` 검증.

- [ ] **Step 4: 최종 커밋 확인** — 미커밋 변경 없는지 `git status`.

---

## Self-Review (계획 vs 스펙 커버리지)

- §3 데이터 → Task 1 ✅ (reason NOT NULL VARCHAR(100), 트리거, RLS disable)
- §4.1 aggregateStats + 분모 분리 → Task 6 ✅ (핵심, 단위 테스트 포함)
- §4.2 getDailyStats 플래그 → Task 7 ✅ / 스키마 Task 2 ✅
- §4.3 월간 리포트 진찰 카드 (2개 함수) → Task 8 ✅
- §4.3+ 월간 리포트 코디네이터별 진찰 참석률 → Task 8B ✅ (Codex 2차 지적 1)
- §4.4 하이라이트 examMissed → Task 9 ✅
- §4.5 슬랙 composer + 라우트 → Task 10, 11 ✅
- §4.6 요일별 통계 → Task 12 ✅
- §4.7 차트 filterClosures + 상세표 → Task 13 ✅
- §4.8 무효화(하이라이트 포함) + 월간 리포트 재생성 안내 → Task 14 + Task 15 안내문 ✅
- §4.9 today rate N/A 폐기 → 계획에 today 변경 없음 ✅
- §5 백엔드 CRUD → Task 2/4/5 ✅
- 수기 Database 타입(`clinic_closures`) → Task 1 Step 2 ✅ (Codex 2차 지적 2 — Task 3 tsc 선결)
- §6 프런트 훅·UI → Task 14/15 ✅
- §7 테스트 → Task 6/9/10/12 ✅
- 마이그레이션 적용 → Task 16 ✅

**2차 리뷰 반영 확인:** 코디네이터 계산기(Task 8B) ✅ · types.ts 승격(Task 1) ✅ · import 별칭 충돌(Task 4 Step 1) ✅ · calculateDailyStats 필드(Task 7 Step 3) ✅ · countInDates 분리+throw(Task 8) ✅ · StatsDetailTable '제외' 유지(Task 13) ✅ · totalConsultation 방침(Task 6) ✅

**구현 중 추가 발견(두 리뷰 모두 놓친 지점):** admin `getCoordinatorWorkload`(`service.ts`, staff-workload 페이지)가 코디별 `consultation_conversion_rate`(진찰 전환율)·`avg_daily_consultation`(일평균 진찰)을 계산한다. `consultation_rate*` 네이밍이 아니라(`totalConsulted`/`consultationConversionRate`) 두 리뷰의 grep에 안 걸렸다. 휴진일에 전 코디 전환율이 왜곡되므로 함께 수정: 진찰 전환율 분모는 휴진일 제외 출석(`coordinatorAttendedForConsult`), 일평균 분모는 휴진일 제외 영업일(`consultationWorkingDays`). 출석 지표(avg_daily_attendance·attendance_rate·팀 평균·워크로드 등급)는 불변.

**타입 일관성:** `is_clinic_closure`(스키마·getDailyStats·stats·차트·상세표), `getClinicClosureDatesSet`(business-days→service→noon route), `consultationRateDays`(StatsAggregate·aggregateStats·평균), `clinicClosed` 옵션(composer·noon route), 훅 3종 이름 일관 ✅

# 휴진일(진찰 없는 날) 관리 — 설계 문서

> 작성일: 2026-07-02
> 상태: 설계 승인 대기 (Codex 리뷰 1차 반영 완료 — 2026-07-02)
>
> **개정 이력**
> - 2026-07-02 초안
> - 2026-07-02 Codex CLI 리뷰 11건 코드 대조 검증 후 반영: 진찰 지표 계산 지점을 5곳 → 월간리포트/하이라이트/요일통계/차트/슬랙 composer까지 확장, `average_consultation_rate` 분모 분리 명시, §4.3(오늘 rate N/A) 폐기, `reason` NOT NULL, 마이그레이션 완성형.

## 1. 배경 / 문제

정신과 낮병원 시스템에서 **진찰 참석률**(`consultation_rate_vs_attendance`)은 "그날 출석한 환자 중 진찰을 받은 비율"이다. 진찰 기록(`consultations` row)이 없는 환자는 그날 **진찰 불참**으로 집계된다.

주치의(레포 주인, 낮병원 환자 대부분 담당)가 휴가를 가면 그 기간에 진찰이 이뤄지지 않는다. 하지만 **환자들은 평소처럼 낮병원에 출석**한다. 현재 시스템은 이 날들을 구분하지 못해, 출석한 환자 전원이 진찰 불참으로 기록되어 진찰 참석률이 왜곡된다.

향후 주치의 휴가·개인 사정 등 "출석은 하지만 진찰만 없는 날"이 반복될 것이므로, 관리자가 그런 날을 지정하면 그날은 진찰 불참으로 집계되지 않게 하는 기능이 필요하다.

### 공휴일과의 차이 (핵심)

| 구분 | 출석 집계 | 진찰 집계 | 관리 도구 |
|---|---|---|---|
| **공휴일**(임시공휴일 포함, 환자도 안 나옴) | 제외 | 제외 | 기존 공휴일 관리 |
| **휴진일**(환자는 나오지만 진찰만 없음) | **포함(정상)** | **제외** | **신규 휴진일 관리** |

공휴일 로직은 출석·진찰·슬랙·요일통계 등 여러 곳에 엮여 있어 여기에 "출석은 살리고 진찰만 빼는" 예외를 섞으면 위험하다. 따라서 **기존 공휴일 코드는 건드리지 않고**, 진찰 지표에만 좁게 작용하는 독립 개념으로 추가한다.

## 2. 결정 사항 (사용자 확정)

- **범위**: 전체 휴진(그날 모든 환자가 진찰 집계에서 제외). 의사별 구분 없음 — 주치의가 환자 대부분을 담당하므로 단순하게 전체 단위로 처리한다.
- **출석**: 정상 집계(휴진일에도 환자는 출석하므로).
- **UI 위치**: 관리자 **통계 페이지**의 기존 공휴일 관리 옆(같은 다이얼로그 내 별도 섹션 또는 인접 버튼).
- **날짜 입력 단위**: 하루씩 추가(공휴일 관리와 동일 방식). 범위 입력 미지원.

## 3. 데이터 모델

새 테이블 `clinic_closures`. 기존 `holidays`와 동일한 형태로 최소한만 둔다.

기존 `holidays`(`date`, `reason VARCHAR(100) NOT NULL`)와 컬럼 규격을 맞춘다.

```sql
CREATE TABLE IF NOT EXISTS clinic_closures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL UNIQUE,
  reason      VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinic_closures_date ON clinic_closures(date);

-- updated_at 트리거 (공용 함수 재사용)
DROP TRIGGER IF EXISTS trg_clinic_closures_updated_at ON clinic_closures;
CREATE TRIGGER trg_clinic_closures_updated_at
  BEFORE UPDATE ON clinic_closures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS 비활성 (프로젝트 규칙 — 모든 테이블 RLS 미사용)
ALTER TABLE clinic_closures DISABLE ROW LEVEL SECURITY;
```

- `reason`은 공휴일과 동일하게 **NOT NULL**, zod `min(1).max(100)` (Codex 지적 9).
- 마이그레이션은 완성형으로 트리거·RLS 구문 포함 (Codex 지적 10). 실제 `update_updated_at()` 함수명은 기존 마이그레이션에서 재확인 후 사용.

- 마이그레이션 파일: `supabase/migrations/`에 idempotent SQL 추가. `holidays` 테이블 마이그레이션(`20260313000001_create_holidays_table.sql`)을 참고.
- 적용은 Supabase MCP `apply_migration` (project_id: `hgkhcbdixubimbraigen`)로 사용자 위임.
- 공휴일 자동 동기화 크론(`holidays-sync`)과 무관 → 휴가 날짜가 덮어써지거나 삭제될 위험 없음.

## 4. 계산 로직에 미치는 영향

핵심 원칙: **진찰 관련 지표에서만 해당 날짜를 제외하고, 출석 지표는 손대지 않는다.**

> **Codex 리뷰 반영**: "진찰 지표"가 계산되는 지점은 초안이 다룬 5곳보다 많다. 아래 7개 지점을 모두 처리한다. 각 항목의 파일·라인은 2026-07-02 코드 대조로 확인함.

### 4.1 진찰 참석률/진찰률 평균 — `aggregateStats` (`src/features/admin/backend/service.ts:879~926`, 평균 산출 `:1348~1356`)

현재 구조 (확인 결과):
- `average_consultation_rate_vs_attendance = consultationRateVsAttendanceSum / consultationDays` — **주 지표. 이미 별도 분모(`consultationDays` = 평일 수)를 씀.** → 휴진일을 `consultationRateVsAttendanceSum`과 `consultationDays` 양쪽에서 빼면 깔끔하게 해결.
- `average_consultation_rate = consultationRateSum / attendanceDays` — **함정(Codex 지적 3). 진찰률(예정 대비)이 출석률과 분모(`attendanceDays`)를 공유한다.** 휴진일의 분자(`consultationRateSum`)만 빼고 분모(`attendanceDays`)를 그대로 두면 평균이 부당하게 낮아진다.

변경:
- `aggregateStats`에 휴진일 집합(`closureSet: Set<string>`)을 인자로 추가.
- **진찰률용 별도 분모 `consultationRateDays` 신설.** 공휴일이 아닌 날마다: 출석률은 항상 누적(`attendanceRateSum`, `attendanceDays++`), 진찰률(`consultationRateSum`)은 **휴진일이 아닐 때만 누적하고 `consultationRateDays++`**.
- 주 지표(`consultationRateVsAttendanceSum`/`consultationDays`)도 평일이면서 **휴진일이 아닐 때만** 누적.
- 평균 산출부: `average_consultation_rate = consultationRateDays > 0 ? consultationRateSum / consultationRateDays : 0`.
- **출석률(`average_attendance_rate`)은 휴진일 포함해 계산 — 절대 건드리지 않는다.**
- 휴진일 집합 조회는 기존 `getHolidayDatesMap`(`src/lib/business-days.ts`) 옆에 동형 헬퍼 `getClinicClosureDatesSet(supabase, start, end): Promise<Set<string>>`를 신설(admin service에서 재노출).

### 4.2 일별 통계 조회 — `getDailyStats` (`:1400~1410` 부근)

- 현재: 조회 시점에 `is_holiday: holidays.has(row.date)` 플래그 부여(daily_stats에는 저장 안 함).
- 변경: 동일하게 `is_clinic_closure: closures.has(row.date)` 플래그를 부여. → `DailyStatsItem` 스키마(`admin/backend/schema.ts`)에 `is_clinic_closure: boolean` 필드 추가.

### 4.3 월간 리포트 진찰 계산기 — `src/features/monthly-report/backend/calculators/consultation.ts` (Codex 지적 1, 신규)

- 현재: `scheduled_attendances`/`consultations`/`attendances`를 월 범위 count 쿼리로 **직접 집계**. `missed = scheduled − performed`, 진찰 참석률 = performed/attended. 휴진일 미제외 시 그대로 왜곡.
- 변경: 세 count 쿼리 모두 **휴진일 날짜를 제외**(`.not('date', 'in', (closureDates))` 또는 휴진일 count를 별도 조회해 차감). 휴진일이 없으면 동작 불변. 출석 계산기(별도)는 손대지 않는다.
- 참고: 이 계산기는 현재 공휴일도 제외하지 않으나, 그건 본 작업 범위 밖(휴진일만 처리).

### 4.4 오늘 하이라이트 `examMissed` — `src/features/highlights/backend/service.ts:137` (Codex 지적 2, 신규)

- 현재: KST 정오 이후 "출석했는데 진찰 기록 없음"이면 `examMissed` 카드에 추가.
- 변경: **오늘이 휴진일이면 `examMissed` 판정을 통째로 건너뜀**(카드 빈 배열). (다른 하이라이트 카드 — 결석 등 — 는 영향 없음.) 서비스에서 `todayStr`가 `clinic_closures`에 있는지 조회하는 분기 추가.

### 4.5 슬랙 정오 리포트 — 라우트 + composer (Codex 지적 4)

- 라우트 `src/app/api/internal/cron/noon-attendance-report/route.ts`: 현재 주말/공휴일 전체 skip. 휴진일은 **skip하지 않고**, `clinic_closures`에 오늘이 있으면 `clinicClosed: true`를 composer에 전달.
- composer `src/server/services/noon-report.ts`의 `composeNoonReportMessage(board, dateLabel, options?)`: `clinicClosed`면 요약줄의 `진찰 c/y` 부분과 "출석 후 미진찰" 섹션·"전원 출석·진찰 완료" 문구를 생략. **미출석 명단은 그대로 발송.**

### 4.6 요일별 통계 — `src/features/shared/lib/stats.ts:calculateDayOfWeekStats` (Codex 지적 5, 신규)

- 현재: `!s.is_holiday` 필터 후, 같은 `items`/`count`로 출석·진찰 평균 동시 산출.
- 변경: 진찰 평균(`avgConsultationRateVsAttendance`, `avgConsultation`)은 **휴진일 제외한 부분집합·별도 분모**로 계산. 출석 평균은 전체 유지. `is_clinic_closure` 플래그 사용.

### 4.7 추이 차트 — `src/features/shared/components/stats/RateLineChart.tsx:44` (Codex 지적 6, 신규)

- 현재: `rates`가 `is_holiday`/주말(`filterWeekends`)만 null 처리. 진찰 차트는 같은 컴포넌트 재사용.
- 변경: `filterClosures?: boolean` prop 추가. **진찰 차트에만 true로 넘겨** 휴진일 point를 null 처리(raw + 7일 이동평균에서 제외). 출석 차트는 false(기본) → 휴진일 정상 표시. `is_clinic_closure` 플래그 사용.

### 4.8 캐시 무효화 정책 (Codex 지적 8)

- 휴진일 CRUD mutation의 onSuccess에서 통계 쿼리 + **하이라이트 쿼리**를 함께 invalidate.
- **월간 리포트는 저장형(생성 시점 스냅샷)** → 휴진일을 나중에 추가/삭제하면 이미 생성된 해당 월 리포트는 자동 반영 안 됨. UI/문서에 "휴진일 변경 시 해당 월 리포트 재생성 필요" 안내를 명시. (자동 재생성은 범위 밖.)

### 4.9 폐기된 초안 항목

- ~~초안 §4.3 "오늘 진찰 참석률 N/A"~~ → **폐기**(Codex 지적 7). 확인 결과 `getStatsSummary` today 블록과 `StatsKpiCards.tsx`는 오늘 진찰을 **rate 없이 건수(`진찰: N명`)로만** 표시한다. N/A 처리할 rate 필드 자체가 없다. 필요 시 "건수 옆 휴진 배지" 정도의 표시만 선택적으로 검토(필수 아님).

### 4.10 손대지 않는 것

- 의사 대기목록(`getWaitingPatients`, 실시간): 그대로 둔다. 휴진일에도 다른 의사들은 진찰하므로 대기목록 표시는 유효.
- 출석률 관련 모든 계산.
- 기존 공휴일 로직 일체.

> 구현 계획 단계에서 위 지점들의 **정확한 파일·라인·함수**를 grep으로 재확인해 전부 나열한다(HANDOFF 워크플로우 규칙).

## 5. 백엔드 (feature 구조)

기존 공휴일 CRUD가 `admin` feature 안에 있으므로 **동일하게 `admin` feature에 추가**한다(별도 feature 디렉토리 신설 없음).

- `admin/backend/schema.ts`: `createClinicClosureSchema`, `getClinicClosuresQuerySchema` + `z.infer` 타입 (공휴일 스키마 패턴 복제)
- `admin/backend/error.ts`: `CLINIC_CLOSURE_FETCH_FAILED` 등 에러 코드 추가
- `admin/backend/service.ts`: `getClinicClosures` / `createClinicClosure` / `deleteClinicClosure` (공휴일 서비스 패턴 복제) + `getClinicClosureDatesSet` 헬퍼
- `admin/backend/route.ts`: `adminRoutes.get/post/delete('/clinic-closures')` (관리자 role 가드)

## 6. 프런트엔드

- `admin/hooks/useClinicClosures.ts`: `useClinicClosures`(useQuery) / `useCreateClinicClosure` / `useDeleteClinicClosure`(useMutation). `@/lib/remote/api-client` 경유. onSuccess 시 통계 쿼리 + **하이라이트 쿼리** invalidate (§4.8).
- `admin/hooks/query-keys.ts`: 휴진일 쿼리 키 추가.
- UI: 통계 페이지(`src/app/dashboard/admin/stats/page.tsx`)에서 기존 공휴일 관리 옆에 "휴진일 관리" 진입점 추가. 기존 `HolidayManageDialog.tsx`와 동일 UX의 `ClinicClosureManageDialog.tsx` 신규 작성(목록 + 날짜 하나 추가 + 삭제). 다이얼로그 안내문에 "휴진일 변경 시 해당 월 월간 리포트는 재생성해야 반영됨" 문구 포함. 전부 Client Component.
- 일별 통계 표에서 휴진일 행의 진찰률을 N/A로 표시하는 렌더 분기 추가(`is_clinic_closure` 플래그 사용). 진찰 추이 차트에는 `RateLineChart`에 `filterClosures` prop 전달(§4.7).

## 7. 검증 / 테스트

- `aggregateStats`: 휴진일이 (a) 진찰 참석률 평균에서 제외, (b) `average_consultation_rate` 분자·분모(`consultationRateDays`) 동시 제외로 평균 왜곡 없음, (c) 출석률에는 정상 포함됨을 단위 테스트(공휴일 제외 테스트 패턴 확장).
- `composeNoonReportMessage`: `clinicClosed` 옵션 시 미진찰 섹션 생략·미출석 명단 유지.
- 월간 리포트 `calculateConsultationStats`: 휴진일 count 제외 검증.
- 요일별 통계·차트: 휴진일이 진찰 평균/차트 point에서만 빠지고 출석에는 남는지.
- 품질 게이트(커밋 전 전부 통과): `npx tsc --noEmit` / `npx eslint src --quiet` / `npx vitest run` / `npm run build`.

## 8. 범위 밖 (YAGNI)

- 의사별 휴진 구분 (전체 단위로 단순화).
- 날짜 범위 일괄 입력.
- 휴진일 자동 동기화/외부 연동.
- 의사 대기목록 실시간 표시 변경.

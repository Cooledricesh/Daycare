# 휴진일(진찰 없는 날) 관리 — 설계 문서

> 작성일: 2026-07-02
> 상태: 설계 승인 대기

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

```sql
CREATE TABLE IF NOT EXISTS clinic_closures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL UNIQUE,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinic_closures_date ON clinic_closures(date);
-- updated_at 트리거는 공용 update_updated_at() 재사용
-- RLS 비활성 (프로젝트 규칙)
```

- 마이그레이션 파일: `supabase/migrations/`에 idempotent SQL 추가. `holidays` 테이블 마이그레이션(`20260313000001_create_holidays_table.sql`)을 참고.
- 적용은 Supabase MCP `apply_migration` (project_id: `hgkhcbdixubimbraigen`)로 사용자 위임.
- 공휴일 자동 동기화 크론(`holidays-sync`)과 무관 → 휴가 날짜가 덮어써지거나 삭제될 위험 없음.

## 4. 계산 로직에 미치는 영향

핵심 원칙: **진찰 관련 지표에서만 해당 날짜를 제외하고, 출석 지표는 손대지 않는다.**

기존 공휴일 처리가 이미 "진찰 집계에서 날짜 제외" 패턴을 갖고 있으므로, 그 지점마다 휴진일 집합을 **추가로 함께 제외**한다.

### 4.1 진찰 참석률 평균 — `aggregateStats` (`src/features/admin/backend/service.ts`)

- 현재: 공휴일은 전체 제외, 주말은 진찰 집계에서만 제외.
- 변경: 기간 내 휴진일 날짜 집합을 조회해, 진찰 참석률/진찰률 누적(`consultationRateVsAttendanceSum`, `consultationDays` 등)에서 **휴진일을 제외**. 단 **출석률 누적에는 휴진일을 계속 포함**(공휴일과 다른 지점).
- 휴진일 집합 조회는 기존 `getHolidayDatesMap`(`src/lib/business-days.ts`)과 동일한 형태의 헬퍼(`getClinicClosureDatesSet` 등)로 추가.

### 4.2 일별 통계 조회 — `getDailyStats` (동 service)

- 현재: 조회 시점에 `is_holiday: holidays.has(row.date)` 플래그를 붙임(daily_stats에는 저장 안 함).
- 변경: 동일하게 `is_clinic_closure: closures.has(row.date)` 플래그를 조회 시점에 부여. 휴진일인 행은 진찰률(`consultation_rate`, `consultation_rate_vs_attendance`)을 프런트에서 N/A로 표시.

### 4.3 오늘 실시간 요약 — `getStatsSummary` today 블록

- 오늘이 휴진일이면 오늘의 진찰 참석률을 N/A(null) 처리. 출석률은 정상.

### 4.4 슬랙 정오 리포트 — `src/app/api/internal/cron/noon-attendance-report/route.ts`

- 현재: 주말/공휴일이면 전체 skip.
- 변경: 휴진일이면 **미진찰 명단 섹션만 생략**, **미출석 명단은 그대로 발송**(출석은 여전히 관리 대상).

### 4.5 손대지 않는 것

- 의사 대기목록(`getWaitingPatients`, 실시간): 그대로 둔다. 휴진일에도 다른 의사들은 진찰하므로 대기목록/미진찰 표시는 유효하다. (역사적 통계만 왜곡을 막으면 됨.)
- 출석률 관련 모든 계산.
- 기존 공휴일 로직 일체.

> 구현 계획 단계에서 위 5개 지점의 **정확한 파일·라인·함수**를 grep으로 재확인해 전부 나열한다(HANDOFF 워크플로우 규칙).

## 5. 백엔드 (feature 구조)

기존 공휴일 CRUD가 `admin` feature 안에 있으므로 **동일하게 `admin` feature에 추가**한다(별도 feature 디렉토리 신설 없음).

- `admin/backend/schema.ts`: `createClinicClosureSchema`, `getClinicClosuresQuerySchema` + `z.infer` 타입 (공휴일 스키마 패턴 복제)
- `admin/backend/error.ts`: `CLINIC_CLOSURE_FETCH_FAILED` 등 에러 코드 추가
- `admin/backend/service.ts`: `getClinicClosures` / `createClinicClosure` / `deleteClinicClosure` (공휴일 서비스 패턴 복제) + `getClinicClosureDatesSet` 헬퍼
- `admin/backend/route.ts`: `adminRoutes.get/post/delete('/clinic-closures')` (관리자 role 가드)

## 6. 프런트엔드

- `admin/hooks/useClinicClosures.ts`: `useClinicClosures`(useQuery) / `useCreateClinicClosure` / `useDeleteClinicClosure`(useMutation). `@/lib/remote/api-client` 경유. onSuccess 시 관련 통계 쿼리 invalidate.
- `admin/hooks/query-keys.ts`: 휴진일 쿼리 키 추가.
- UI: 통계 페이지(`src/app/dashboard/admin/stats/page.tsx`)에서 기존 공휴일 관리 옆에 "휴진일 관리" 진입점 추가. 기존 `HolidayManageDialog.tsx`와 동일 UX의 `ClinicClosureManageDialog.tsx` 신규 작성(목록 + 날짜 하나 추가 + 삭제). 전부 Client Component.
- 일별 통계 표에서 휴진일 행의 진찰률을 N/A로 표시하는 렌더 분기 추가(`is_clinic_closure` 플래그 사용).

## 7. 검증 / 테스트

- `getClinicClosureDatesSet` 및 `aggregateStats`의 휴진일 제외 로직 단위 테스트(공휴일 제외 테스트가 있으면 그 패턴 확장).
- 시나리오: 휴진일에 출석 O·진찰 X인 환자들이 (a) 진찰 참석률 평균에 영향 없음, (b) 출석률에는 정상 반영, (c) 슬랙 리포트에서 미진찰 명단 미포함·미출석 명단 포함.
- 품질 게이트(커밋 전 전부 통과): `npx tsc --noEmit` / `npx eslint src --quiet` / `npx vitest run` / `npm run build`.

## 8. 범위 밖 (YAGNI)

- 의사별 휴진 구분 (전체 단위로 단순화).
- 날짜 범위 일괄 입력.
- 휴진일 자동 동기화/외부 연동.
- 의사 대기목록 실시간 표시 변경.

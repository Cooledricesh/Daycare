# Monthly Report Implementation Plan

## Overview

- **목적**: 매월 1일 자동 생성되는 관리자 회의용 월간 출석/진찰 성과 리포트
- **Spec 참조**: [monthly-report-spec.md](../specs/monthly-report-spec.md)
- **URL**: `/dashboard/admin/monthly-report`
- **Feature 명**: `monthly-report`

---

## Component Hierarchy

```
MonthlyReportPage (src/app/dashboard/admin/monthly-report/page.tsx)
└── MonthlyReportSection
    ├── ReportHeader
    │   ├── MonthSelector
    │   ├── RegenerateButton + ConfirmDialog
    │   └── GeneratedAtBadge
    ├── ExecutiveSummaryCards
    │   ├── TotalAttendanceDaysCard       (헤드라인)
    │   ├── PerPatientAvgDaysCard
    │   ├── DailyAvgAttendanceCard
    │   ├── ConsultationRateCard
    │   └── RegisteredCountCard
    ├── TrendSection
    │   ├── WeeklyTrendChart              (recharts LineChart)
    │   ├── WeekdayAvgBarChart            (recharts BarChart)
    │   └── PrevMonthComparisonTable
    ├── CoordinatorPerformanceTable
    ├── PatientSegmentsSection
    │   ├── TopAttendersTable
    │   ├── RiskPatientsTable
    │   ├── NewPatientsTable
    │   └── DischargesTable               (유형 뱃지)
    ├── ConsultationStatsSection
    ├── SpecialNotesSection
    └── ActionItemsEditor                 (Textarea + Save)
```

---

## File Structure

```
src/features/monthly-report/
├── backend/
│   ├── error.ts              # MonthlyReportErrorCodes
│   ├── schema.ts             # zod 스키마 (요청/응답)
│   ├── service.ts            # 지표 계산 로직 (generate, get, patch, regenerate)
│   ├── route.ts              # Hono 라우터
│   └── calculators/
│       ├── attendance.ts     # 출석 지표 계산
│       ├── consultation.ts   # 진찰 지표 계산
│       ├── coordinator.ts    # 코디별 성과
│       ├── segments.ts       # 환자 세그먼트
│       ├── trend.ts          # 주차별/요일별 추이
│       ├── discharges.ts     # sync_logs 기반 퇴원 조회
│       └── special-notes.ts  # 공휴일/이상치/데이터 누락
├── components/
│   ├── MonthlyReportSection.tsx
│   ├── ReportHeader.tsx
│   ├── ExecutiveSummaryCards.tsx
│   ├── TotalAttendanceDaysCard.tsx
│   ├── PerPatientAvgDaysCard.tsx
│   ├── DailyAvgAttendanceCard.tsx
│   ├── ConsultationRateCard.tsx
│   ├── RegisteredCountCard.tsx
│   ├── WeeklyTrendChart.tsx
│   ├── WeekdayAvgBarChart.tsx
│   ├── PrevMonthComparisonTable.tsx
│   ├── CoordinatorPerformanceTable.tsx
│   ├── TopAttendersTable.tsx
│   ├── RiskPatientsTable.tsx
│   ├── NewPatientsTable.tsx
│   ├── DischargesTable.tsx
│   ├── DischargeTypeBadge.tsx
│   ├── ConsultationStatsSection.tsx
│   ├── SpecialNotesSection.tsx
│   └── ActionItemsEditor.tsx
├── hooks/
│   ├── useMonthlyReport.ts           # GET
│   ├── useRegenerateMonthlyReport.ts # POST regenerate
│   ├── useUpdateActionItems.ts       # PATCH action-items
│   └── useMonthlyReportList.ts       # GET list
├── constants/
│   ├── thresholds.ts         # 집중관리 임계치 (50%, 5일 등), Top N 개수
│   └── labels.ts             # 퇴원 유형 라벨 매핑
└── lib/
    └── dto.ts                # backend/schema 재노출

src/app/dashboard/admin/monthly-report/
└── page.tsx                  # 'use client' + Promise params

src/app/api/internal/cron/monthly-report-generate/
└── route.ts                  # 크론 엔드포인트 (Hono 외부, CRON_SECRET 검증)

supabase/migrations/
└── 20260424000001_create_monthly_reports.sql
```

---

## Implementation Tasks

### Phase 1: 스키마 및 백엔드 기반 (P0)

#### Task 1.1: Migration 작성
- [ ] `supabase/migrations/20260424000001_create_monthly_reports.sql`
  - `monthly_reports` 테이블 생성 (spec §2.1)
  - 인덱스, CHECK 제약, RLS 비활성화
  - `update_updated_at` 트리거 연결
- 완료 기준: 마이그레이션 파일 생성 후 사용자에게 적용 요청

#### Task 1.2: zod 스키마 정의
- [ ] `src/features/monthly-report/backend/schema.ts`
  - `GetMonthlyReportQuerySchema`, `MonthlyReportResponseSchema`
  - 각 JSONB 구조별 스키마 (`WeeklyTrendEntrySchema`, `CoordinatorPerformanceSchema`, 등)
  - `ActionItemsUpdateSchema` (max 5000자)
  - `RegenerateParamsSchema`

#### Task 1.3: 에러 코드 정의
- [ ] `src/features/monthly-report/backend/error.ts`
  - `MonthlyReportErrorCodes` 상수
  - `MonthlyReportError` 클래스

### Phase 2: 지표 계산 로직 (P0)

각 calculator는 순수 함수로 작성, supabase client를 인자로 받음. 모두 Supabase 1000행 제한을 염두에 두고 페이지네이션 처리.

#### Task 2.1: 출석 지표 계산 (`calculators/attendance.ts`)
- [ ] `calculateTotalAttendanceDays(supabase, year, month)` — spec §4.1
- [ ] `calculatePerPatientAvgDays(supabase, totalDays, year, month)` — spec §4.2
- [ ] `calculateDailyAvgAttendance(supabase, totalDays, year, month)` — spec §4.3 (holidays 조회)
- [ ] `getRegisteredCountEom(supabase, year, month)` — 월말 기준 active 환자 수

#### Task 2.2: 진찰 지표 계산 (`calculators/consultation.ts`)
- [ ] `calculateConsultationStats(supabase, year, month)` — spec §4.4
  - `scheduled_count`, `performed_count`, `missed_count`, `missed_by_reason`

#### Task 2.3: 트렌드 계산 (`calculators/trend.ts`)
- [ ] `calculateWeeklyTrend(supabase, year, month)` — ISO 주차 기준, 영업일 수 포함
- [ ] `calculateWeekdayAvg(supabase, year, month)` — 월~금 평균 출석 인원
- [ ] `calculatePrevMonthComparison(supabase, current, prev)` — 전월 리포트 조회하여 delta 계산

#### Task 2.4: 코디별 성과 (`calculators/coordinator.ts`)
- [ ] `calculateCoordinatorPerformance(supabase, year, month)`
  - 모든 코디 순회, 담당 active 환자 기준
  - 각 코디별: 담당 환자 수, 평균 출석률, 진찰 참석률, 연속 3일+ 결석자 수 (spec §4.9)

#### Task 2.5: 환자 세그먼트 (`calculators/segments.ts`)
- [ ] `getTopAttenders(supabase, year, month)` — spec §4.7
- [ ] `getRiskPatients(supabase, year, month)` — spec §4.6
- [ ] `getNewPatients(supabase, year, month)` — spec §4.8
- [ ] `getConsecutiveAbsenceCount(supabase, patientId, year, month)` — 최장 연속 결석 계산

#### Task 2.6: 퇴원 조회 (`calculators/discharges.ts`)
- [ ] `getDischargesFromSyncLogs(supabase, year, month)` — spec §4.5
  - JSONB array unnest → ward_admission/activity_stop 필터
  - `patient_id_no` 로 patients LEFT JOIN

#### Task 2.7: 특이사항 (`calculators/special-notes.ts`)
- [ ] `getSpecialNotes(supabase, year, month)`
  - 해당 월 공휴일 목록
  - 이상치 일자: 일일 출석 수가 평균 ± 2σ 벗어난 날
  - 데이터 누락: `scheduled_attendances` 있지만 해당 월에 `attendances`도 결석 마킹도 없는 날

### Phase 3: 서비스 레이어 및 라우터 (P0)

#### Task 3.1: 서비스 (`backend/service.ts`)
- [ ] `generateMonthlyReport(supabase, year, month, generatedBy)`
  - 2026-03 이전/미래 검증
  - 모든 calculator 병렬 호출 (Promise.all)
  - UPSERT `monthly_reports` (ON CONFLICT year/month DO UPDATE, `action_items` 보존)
  - 반환: 생성된 리포트
- [ ] `getMonthlyReport(supabase, year, month)`
  - 테이블 조회, 없으면 `generateMonthlyReport` 호출 후 반환
- [ ] `regenerateMonthlyReport(supabase, year, month)`
  - 기존 `action_items` 보존하며 재계산
- [ ] `updateActionItems(supabase, year, month, text)`
- [ ] `listMonthlyReports(supabase)` — year/month/generated_at 목록

#### Task 3.2: 라우터 (`backend/route.ts`)
- [ ] `registerMonthlyReportRoutes(app)` 함수
- [ ] 5개 엔드포인트 구현 (spec §3.1~3.4 + 크론 분리)
- [ ] 관리자 권한 가드 미들웨어 (기존 admin 라우터 패턴 재사용)
- [ ] `success`/`failure`/`respond` 패턴 적용

#### Task 3.3: Hono 앱 등록
- [ ] `src/backend/hono/app.ts`에 `registerMonthlyReportRoutes(app)` 추가

### Phase 4: 크론 엔드포인트 (P0)

#### Task 4.1: 크론 API Route
- [ ] `src/app/api/internal/cron/monthly-report-generate/route.ts`
  - Next.js Route Handler (Hono 외부, 독립 엔드포인트)
  - `Authorization: Bearer ${CRON_SECRET}` 검증
  - KST 기준 "어제가 속한 달"의 리포트 생성 (spec §5.1)
  - 이미 존재하면 skip, 없으면 `generateMonthlyReport(..., 'cron')`
- [ ] `runtime = 'nodejs'`

#### Task 4.2: 환경 변수 및 vercel.json
- [ ] `.env.example`에 `CRON_SECRET` 추가
- [ ] `vercel.json` 생성 (spec §5.1)
  ```json
  { "crons": [{ "path": "/api/internal/cron/monthly-report-generate", "schedule": "30 15 1 * *" }] }
  ```

### Phase 5: 프론트엔드 (P0)

#### Task 5.1: DTO 및 훅
- [ ] `src/features/monthly-report/lib/dto.ts` — schema 재노출
- [ ] `useMonthlyReport(year, month)` — `queryKey: ['monthly-report', year, month]`
- [ ] `useMonthlyReportList()` — `queryKey: ['monthly-report', 'list']`
- [ ] `useRegenerateMonthlyReport()` — mutation + invalidate
- [ ] `useUpdateActionItems()` — mutation + invalidate
- [ ] 모든 HTTP는 `@/lib/remote/api-client` 경유

#### Task 5.2: 페이지 및 레이아웃
- [ ] `src/app/dashboard/admin/monthly-report/page.tsx`
  - `'use client'`, `params: Promise<{}>`, `searchParams: Promise<{ year?, month? }>`
  - `<MonthlyReportSection />` 렌더
- [ ] `MonthlyReportSection.tsx` — 전체 섹션 조립, 쿼리 파라미터 기반 년월 결정
- [ ] 사이드바에 "월간 리포트" 메뉴 추가 (기존 admin navigation 확장)

#### Task 5.3: 헤더 컴포넌트
- [ ] `ReportHeader.tsx` — 월 선택 드롭다운 + 재계산 버튼 + 생성 시각
- [ ] `MonthSelector.tsx` — `useMonthlyReportList` 기반 드롭다운
- [ ] `RegenerateButton.tsx` — shadcn Dialog로 확인 단계 포함
- [ ] `GeneratedAtBadge.tsx` — date-fns로 포맷팅

#### Task 5.4: Executive Summary
- [ ] `ExecutiveSummaryCards.tsx` — 그리드 레이아웃
- [ ] 5개 카드 컴포넌트 (TotalAttendanceDays / PerPatientAvg / DailyAvg / Consultation / RegisteredCount)
- [ ] 각 카드에 전월 대비 delta 표시 (▲/▼ + %)

#### Task 5.5: Trend 섹션
- [ ] `WeeklyTrendChart.tsx` — recharts (없으면 설치 필요 → 사용자에게 확인 요청)
- [ ] `WeekdayAvgBarChart.tsx`
- [ ] `PrevMonthComparisonTable.tsx`

#### Task 5.6: Coordinator & Segments
- [ ] `CoordinatorPerformanceTable.tsx` — 순위 없이 이름순 정렬
- [ ] `TopAttendersTable.tsx`, `RiskPatientsTable.tsx`, `NewPatientsTable.tsx`
- [ ] `DischargesTable.tsx` + `DischargeTypeBadge.tsx`
  - 라벨: "병동 입원" / "마루 중단" (constants/labels.ts)

#### Task 5.7: Consultation, Notes, Action Items
- [ ] `ConsultationStatsSection.tsx`
- [ ] `SpecialNotesSection.tsx`
- [ ] `ActionItemsEditor.tsx` — Textarea + debounced save + 수동 저장 버튼

### Phase 6: 품질 검증 (P0)

#### Task 6.1: TypeScript / ESLint
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과

#### Task 6.2: 빌드
- [ ] `npm run build` 통과

#### Task 6.3: 3월 리포트 수동 생성 검증
- [ ] 마이그레이션 적용 후
- [ ] `POST /api/admin/monthly-reports/2026/3/regenerate` 호출
- [ ] 반환 JSON의 핵심 지표가 실제 DB 값과 일치하는지 샘플 검증
  - `SELECT COUNT(*) FROM attendances WHERE date BETWEEN '2026-03-01' AND '2026-03-31'` vs `total_attendance_days`
  - 코디별 담당 환자 수 vs `coordinator_performance[].assigned_patient_count`
- [ ] 퇴원 유형이 sync_logs 원본과 일치하는지 확인

#### Task 6.4: 페이지 UI 확인
- [ ] dev 서버에서 `/dashboard/admin/monthly-report?year=2026&month=3` 접속
- [ ] 모든 섹션 정상 렌더링
- [ ] 재계산 버튼 동작
- [ ] 액션 아이템 저장 동작
- [ ] 월 선택 드롭다운 동작

### Phase 7: 크론잡 배포 확인 (P0)

- [ ] Vercel 대시보드에서 Cron 작업 등록 확인
- [ ] `CRON_SECRET` 환경 변수 프로덕션 설정 (사용자 작업)
- [ ] 수동 트리거 테스트 (`Authorization` 헤더 포함 curl)

---

## Dependencies

### 신규 라이브러리

- **없음**. `recharts ^3.5.1` 이미 설치됨. 모든 기능은 기존 라이브러리 (date-fns, ts-pattern, zod, react-query, shadcn-ui, recharts)로 해결

### 스키마 변경 없음

- `patients.discharge_type` 등 추가하지 않음 (sync_logs 활용 A안)

### 기존 리소스 재사용

- `holidays` 테이블 (공휴일)
- `sync_logs.details.changes` (퇴원 유형)
- `@/lib/remote/api-client` (HTTP 클라이언트)
- 기존 admin layout guard (관리자 권한)

---

## Out of Scope (v2 이후 후보)

- 실질 출석률 (재원기간 기반 가능 출석일수 대비 %)
- PDF 다운로드
- 전년 동월 비교
- 장기지속형 주사제 이행률 (현재 100%라 불필요)
- 코디별 성과 순위표

---

## Rollout 전략

1. 마이그레이션 적용 → 테이블 생성
2. 백엔드/프론트엔드 구현 완료 후 dev 환경에서 3월 리포트 수동 생성 → 수치 검증
3. 관리자에게 3월 리포트 시연 및 피드백 수렴
4. 프로덕션 배포 + `CRON_SECRET` 설정
5. 5월 1일 자동 생성 실행 모니터링 → 4월 리포트 정상 생성 확인

---

## 주요 리스크 및 대응

| 리스크 | 대응 |
|---|---|
| sync_logs.details JSONB 쿼리 성능 | 월별 조회이므로 `started_at` 인덱스로 충분. 단일 월당 sync 레코드 수 제한적 |
| 크론 실행 실패 | 엔드포인트가 idempotent (이미 있으면 skip). 수동 재계산 버튼으로 복구 가능 |
| Supabase 1000행 제한 | 모든 환자 순회 쿼리는 `range` 페이지네이션 적용 (memory: project_supabase_row_cap.md) |
| KST/UTC 혼동 | 서비스 내 `toZonedTime(date, 'Asia/Seoul')` 일관 적용, 쿼리 날짜 경계는 KST 기준으로 UTC 변환 |
| 3월 데이터 품질 | 첫 리포트 생성 시 반드시 수동 검증, 필요 시 `special_notes`에 데이터 품질 이슈 기록 |

# Monthly Report 기술 명세

## Overview

관리자 회의용 **월간 출석/진찰 성과 리포트** 기능의 기술 요구사항을 정의한다.

- 페이지: `/dashboard/admin/monthly-report` (M4 대시보드 내)
- 자동 생성: 매월 1일 00:30 KST에 전월 리포트 생성
- 시작 월: 2026-03 (앱 정상 가동 시점)
- Feature 명: `monthly-report`

---

## 1. 설계 원칙

- 모든 수치는 **사전 집계 후 저장** (리포트 생성 시점에 스냅샷)
  - 사후 데이터 변경(지난 출석 정정 등)이 리포트 수치에 영향을 주지 않도록 `monthly_reports` 테이블에 저장
  - 재생성이 필요한 경우 관리자가 수동 "재계산" 버튼으로 트리거
- 퇴원 유형은 `sync_logs.details.changes` JSONB에서 조회 (스키마 변경 없음)
- 공휴일은 기존 `holidays` 테이블 활용
- 페이지 진입 시 리포트가 없으면 **즉시 생성 후 표시** (lazy generation)

---

## 2. Database Schema

### 2.1 `monthly_reports` 테이블 (신규)

월별 리포트 스냅샷 저장. 크론/수동 재계산 모두 이 테이블을 UPSERT 한다.

```sql
CREATE TABLE IF NOT EXISTS monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- 핵심 지표
  total_attendance_days INTEGER NOT NULL DEFAULT 0,         -- 월 총 출석일수
  per_patient_avg_days NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 1인당 월평균 출석일수
  daily_avg_attendance NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 일평균 출석 인원
  consultation_attendance_rate NUMERIC(5,2) NOT NULL DEFAULT 0, -- 진찰 참석률 (%)
  registered_count_eom INTEGER NOT NULL DEFAULT 0,           -- 월말 등록 환자 수
  new_patient_count INTEGER NOT NULL DEFAULT 0,              -- 신규 환자 수
  discharged_count INTEGER NOT NULL DEFAULT 0,               -- 퇴원 환자 수

  -- 상세 데이터 (JSONB)
  weekly_trend JSONB NOT NULL DEFAULT '[]'::jsonb,           -- 주차별 추이
  weekday_avg JSONB NOT NULL DEFAULT '{}'::jsonb,            -- 요일별 평균
  prev_month_comparison JSONB NOT NULL DEFAULT '{}'::jsonb,  -- 전월 대비
  coordinator_performance JSONB NOT NULL DEFAULT '[]'::jsonb, -- 코디별 성과
  patient_segments JSONB NOT NULL DEFAULT '{}'::jsonb,       -- 환자 세그먼트
  consultation_stats JSONB NOT NULL DEFAULT '{}'::jsonb,     -- 진찰 운영
  special_notes JSONB NOT NULL DEFAULT '[]'::jsonb,          -- 특이사항

  -- 액션 아이템 (관리자 편집 가능)
  action_items TEXT NOT NULL DEFAULT '',

  -- 메타데이터
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by VARCHAR(20) NOT NULL DEFAULT 'cron',          -- 'cron' | 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_year_month ON monthly_reports(year DESC, month DESC);

ALTER TABLE monthly_reports DISABLE ROW LEVEL SECURITY;
```

### 2.2 JSONB 구조 정의

#### `weekly_trend`
```typescript
Array<{
  week_number: number;       // 1~5 (월 내 주차)
  start_date: string;        // YYYY-MM-DD
  end_date: string;          // YYYY-MM-DD
  total_attendance: number;  // 해당 주 출석일수
  working_days: number;      // 평일 수 (공휴일 제외)
}>
```

#### `weekday_avg`
```typescript
{
  mon: number;  // 월요일 평균 출석 인원
  tue: number;
  wed: number;
  thu: number;
  fri: number;
}
```

#### `prev_month_comparison`
```typescript
{
  total_attendance_days_delta: number;        // 전월 대비 증감 (절대값)
  total_attendance_days_delta_pct: number;    // 전월 대비 증감 (%)
  per_patient_avg_days_delta: number;
  daily_avg_attendance_delta: number;
  consultation_rate_delta: number;
  registered_count_delta: number;
}
```

#### `coordinator_performance`
```typescript
Array<{
  coordinator_id: string;
  coordinator_name: string;
  assigned_patient_count: number;       // 담당 환자 수 (월말 기준)
  avg_attendance_rate: number;          // 평균 출석률 (%)
  consultation_attendance_rate: number; // 진찰 참석률 (%)
  consecutive_absence_patient_count: number; // 연속 3일+ 결석 환자 수
}>
```

#### `patient_segments`
```typescript
{
  top_attenders: Array<{               // 출석 우수 (상위 N명, 기본 N=10)
    patient_id: string;
    name: string;
    attendance_days: number;
    attendance_rate: number;
  }>;
  risk_patients: Array<{                // 집중 관리 대상
    patient_id: string;
    name: string;
    attendance_days: number;
    attendance_rate: number;
    longest_consecutive_absence: number;
  }>;
  new_patients: Array<{                 // 신규 등록 정착도
    patient_id: string;
    name: string;
    registered_date: string;
    attendance_days: number;
    possible_days: number;              // 등록 후 경과 평일 수
  }>;
  discharges: Array<{                   // 퇴원 환자 (유형 포함)
    patient_id: string | null;          // sync_logs 기반이라 null 가능
    patient_id_no: string;
    name: string;
    discharge_date: string;             // sync_logs.started_at 기준
    type: 'ward_admission' | 'activity_stop';  // sync_logs에서 판별
  }>;
}
```

#### `consultation_stats`
```typescript
{
  scheduled_count: number;              // 월간 진찰 예정 건수
  performed_count: number;              // 월간 진찰 실시 건수
  missed_count: number;                 // 누락 건수
  missed_by_reason: {
    absent: number;                     // 환자 결석으로 인한 누락
    other: number;                      // 기타
  };
}
```

#### `special_notes`
```typescript
Array<{
  type: 'holiday' | 'outlier' | 'data_gap';
  date: string;                         // YYYY-MM-DD
  description: string;
}>
```

---

## 3. API Endpoints

모든 엔드포인트는 관리자 권한 필수. 경로는 Hono 라우터 기반 `/api/admin/monthly-reports/*`.

### 3.1 GET `/api/admin/monthly-reports/:year/:month`

해당 월 리포트 조회. 없으면 **즉시 생성 후 반환** (lazy).

**Request Params**:
- `year`: 숫자 (예: 2026)
- `month`: 숫자 1~12

**Response**:
```typescript
interface GetMonthlyReportResponse {
  year: number;
  month: number;
  // monthly_reports 테이블의 모든 컬럼 (JSONB 포함)
  ...
  generated_at: string;
  generated_by: 'cron' | 'manual';
}
```

**Error Codes**:
- 400: 잘못된 year/month (미래 월 또는 2026-03 이전 요청)
- 401: 미인증
- 403: 관리자 아님
- 404: 없음 (생성도 실패한 경우)

### 3.2 POST `/api/admin/monthly-reports/:year/:month/regenerate`

리포트 강제 재계산 (`action_items`는 보존).

**Response**: 3.1과 동일 (재계산 후 최신 데이터)

**Error Codes**:
- 400: 미래 월 요청
- 401/403: 권한 오류

### 3.3 PATCH `/api/admin/monthly-reports/:year/:month/action-items`

액션 아이템 메모 업데이트.

**Request Body**:
```typescript
{ action_items: string }  // max 5000자
```

**Response**:
```typescript
{ success: true, updated_at: string }
```

### 3.4 GET `/api/admin/monthly-reports`

생성된 리포트 목록 (연도/월 목록만).

**Response**:
```typescript
Array<{ year: number; month: number; generated_at: string }>
```

### 3.5 POST `/api/internal/cron/monthly-report-generate`

**내부용** 크론 엔드포인트. 헤더 `Authorization: Bearer ${CRON_SECRET}`로 인증.
매월 1일 00:30 KST 실행 → 전월 리포트 생성 (이미 있으면 스킵, `generated_by='cron'`).

**Response**:
```typescript
{ year: number; month: number; status: 'generated' | 'skipped' }
```

---

## 4. 지표 계산 규칙

### 4.1 월 총 출석일수 (`total_attendance_days`)

```sql
SELECT COUNT(*) FROM attendances
WHERE date >= '${year}-${month}-01'
  AND date < '${year}-${month+1}-01';
```

### 4.2 1인당 월평균 출석일수 (`per_patient_avg_days`)

```
= total_attendance_days / registered_count_eom
```

`registered_count_eom`: 월말일 23:59 기준 `status = 'active'` 환자 수. 월말 시점이 이미 지난 경우에만 계산; 아직 진행 중인 월은 "현재 시점" 기준.

### 4.3 일평균 출석 인원 (`daily_avg_attendance`)

```
= total_attendance_days / 해당월 영업일수(평일 - 공휴일)
```

### 4.4 진찰 참석률 (`consultation_attendance_rate`)

- 분자: 해당 월 내 `consultations` 테이블에서 `performed = true` 건수
- 분모: 해당 월 내 예정된 진찰 건수 (기존 진찰 예정 로직 재사용)
- 예정 진찰이 0건이면 0으로 처리

### 4.5 퇴원 유형 판별

```sql
SELECT
  (change->>'patientIdNo') AS patient_id_no,
  (change->>'name') AS name,
  (change->>'action') AS type,
  sl.started_at AS discharge_date
FROM sync_logs sl,
     jsonb_array_elements(sl.details->'changes') AS change
WHERE sl.started_at >= '${month_start}'
  AND sl.started_at < '${next_month_start}'
  AND change->>'action' IN ('ward_admission', 'activity_stop');
```

이후 `patient_id_no`로 `patients` 테이블과 LEFT JOIN 하여 `patient_id` 보강. 매칭 실패해도 표시.

### 4.6 집중 관리 대상 (`risk_patients`)

다음 중 하나에 해당하면 포함:
- 해당 월 출석률(`attendance_days / possible_days`) < 50%
- 최장 연속 결석 ≥ 5일

정렬: 최장 연속 결석 DESC, 출석률 ASC. 최대 10명.

### 4.7 출석 우수 (`top_attenders`)

해당 월 출석일수 DESC 상위 10명. 월간 재원기간 < 10일인 환자는 제외 (왜곡 방지).

### 4.8 신규 환자 정착도 (`new_patients`)

해당 월 내 `patients.created_at`이 포함된 환자. `possible_days`는 등록일~월말의 평일 수 - 공휴일.

### 4.9 연속 3일+ 결석 판별 (`consecutive_absence_patient_count`)

해당 환자의 `scheduled_attendances` 중 `attendances`에 매칭 없는 날을 연속 구간으로 그룹화하여 3일 이상 존재하면 카운트.

---

## 5. 크론잡 설정

### 5.1 Vercel Cron (권장)

`vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/internal/cron/monthly-report-generate",
      "schedule": "0 1 1 * *"
    }
  ]
}
```

> Vercel Cron은 UTC 기준. KST 1일 10:00 = UTC 1일 01:00 → `0 1 1 * *`. 서버는 "KST 기준 어제가 속한 달(=전월)의 리포트" 생성.

**채택안**: `0 1 1 * *` + 서버는 "KST 기준 어제가 속한 달의 리포트" 생성 (매월 1일 KST 10:00, 전월 리포트 생성).

### 5.2 보안

`CRON_SECRET` 환경 변수 추가. 엔드포인트에서 `Authorization: Bearer` 검증. Vercel Cron은 자동으로 `Authorization` 헤더 포함.

---

## 6. 페이지 UI 구조

### 6.1 URL / 라우팅

- `/dashboard/admin/monthly-report` — 가장 최근 생성 리포트 (기본: 전월)
- `/dashboard/admin/monthly-report?year=2026&month=3` — 특정 월

### 6.2 레이아웃

```
MonthlyReportPage
├── AdminLayout
└── MonthlyReportSection
    ├── ReportHeader
    │   ├── MonthSelector (드롭다운, 생성된 월 목록)
    │   ├── RegenerateButton (확인 다이얼로그)
    │   └── GeneratedAtBadge
    ├── ExecutiveSummary
    │   ├── TotalAttendanceDaysCard (헤드라인, 큰 숫자)
    │   ├── PerPatientAvgDaysCard
    │   ├── DailyAvgAttendanceCard
    │   ├── ConsultationRateCard
    │   └── RegisteredCountCard (신규/퇴원 포함)
    ├── TrendSection
    │   ├── WeeklyTrendChart
    │   ├── WeekdayAvgChart
    │   └── PrevMonthComparisonTable
    ├── CoordinatorPerformanceTable
    ├── PatientSegmentsSection
    │   ├── TopAttendersTable
    │   ├── RiskPatientsTable
    │   ├── NewPatientsTable
    │   └── DischargesTable (유형 뱃지)
    ├── ConsultationStatsSection
    ├── SpecialNotesSection
    └── ActionItemsEditor (Textarea + 저장 버튼)
```

### 6.3 상태 관리

- `@tanstack/react-query`로 `GET /api/admin/monthly-reports/:year/:month` 캐싱
- `PATCH action-items` mutation → 성공 시 쿼리 invalidate
- `POST regenerate` mutation → 성공 시 쿼리 invalidate + 토스트

---

## 7. 에러 처리

### 7.1 Error Codes (backend/error.ts)

```typescript
export const MonthlyReportErrorCodes = {
  INVALID_PERIOD: 'monthly_report/invalid_period',           // 2026-03 이전 또는 미래
  GENERATION_FAILED: 'monthly_report/generation_failed',
  NOT_FOUND: 'monthly_report/not_found',
  UNAUTHORIZED: 'monthly_report/unauthorized',
  ACTION_ITEMS_TOO_LONG: 'monthly_report/action_items_too_long',
} as const;
```

### 7.2 경계 조건

- 2026-03 이전 요청 → 400 `INVALID_PERIOD`
- 현재 진행 중인 월 요청 → 허용 (중간 집계, `generated_at` 표시)
- 미래 월 요청 → 400 `INVALID_PERIOD`
- 등록 환자 0명 → `per_patient_avg_days = 0` (division by zero 방지)
- 예정 진찰 0건 → `consultation_attendance_rate = 0`

---

## 8. 권한

- 모든 엔드포인트: 로그인 + `role = 'admin'` 필수
- 크론 엔드포인트: `CRON_SECRET` 검증 + 세션 불필요
- 페이지: 관리자만 접근 가능 (기존 admin layout guard 재사용)

---

## 9. 확장 여지 (v2 이후)

- 실질 출석률 (재원기간 기반 가능 출석일수 대비)
- PDF 다운로드
- 전년 동월 비교
- 코디별 성과 순위 토글

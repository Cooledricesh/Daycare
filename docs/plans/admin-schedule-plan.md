# Admin Schedule Page Implementation Plan

## Overview

- **페이지 목적**: 기본 출석 스케줄 관리 및 일일 예정 출석 관리
- **PRD 참조**: [Section 6.2 scheduled_patterns, scheduled_attendances](../prd.md#scheduled_patterns-기본-출석-스케줄)
- **URL**: `/admin/schedule`

## Component Hierarchy

```
AdminSchedulePage
├── AdminLayout
│   ├── AdminHeader
│   └── AdminSidebar
└── ScheduleManagementSection
    ├── SchedulePageHeader
    │   ├── PageTitle
    │   └── TabNavigation
    │       ├── BasicScheduleTab (기본 스케줄)
    │       └── DailyScheduleTab (일일 예정)
    ├── BasicSchedulePanel (Tab 1)
    │   ├── PatientScheduleList
    │   │   ├── SearchBar
    │   │   └── PatientScheduleRow[]
    │   │       ├── PatientNameCell
    │   │       ├── CoordinatorCell
    │   │       ├── SchedulePatternDisplay
    │   │       │   └── DayBadges[] (월,화,수,목,금)
    │   │       └── EditButton
    │   ├── Pagination
    │   └── SchedulePatternModal
    │       ├── ModalHeader
    │       ├── PatientInfo (읽기 전용)
    │       ├── DayCheckboxGroup
    │       │   └── Checkbox[] (일~토)
    │       └── ModalFooter
    │           ├── CancelButton
    │           └── SaveButton
    └── DailySchedulePanel (Tab 2)
        ├── DateSelector
        │   ├── DatePicker
        │   └── TodayButton
        ├── ScheduledAttendanceStats
        │   ├── TotalCount
        │   ├── BySourceCount (auto/manual)
        │   └── CancelledCount
        ├── ScheduledAttendanceList
        │   ├── FilterBar
        │   │   ├── SourceFilter (전체/자동/수동)
        │   │   └── StatusFilter (전체/예정/취소)
        │   └── ScheduledAttendanceRow[]
        │       ├── PatientNameCell
        │       ├── CoordinatorCell
        │       ├── SourceBadge
        │       ├── StatusBadge
        │       └── ActionsCell
        │           ├── CancelButton (is_cancelled 토글)
        │           └── RemoveButton (수동 추가 건만)
        ├── AddManualAttendanceButton
        └── ManualAttendanceModal
            ├── ModalHeader
            ├── PatientSelect
            └── ModalFooter
                ├── CancelButton
                └── AddButton
```

## Features by Priority

### P0 (Must Have)

#### 기본 스케줄 관리 (Tab 1)
- [ ] 환자별 기본 출석 패턴 조회 (페이지네이션)
- [ ] 환자 검색 (이름)
- [ ] 출석 패턴 수정 모달
  - [ ] 요일 체크박스 (일~토)
  - [ ] 저장 시 scheduled_patterns 테이블 업데이트
- [ ] 출석 패턴 표시 (Badge: 월,수,금 형태)

#### 일일 예정 출석 관리 (Tab 2)
- [ ] 날짜 선택 (기본: 오늘)
- [ ] 선택된 날짜의 예정 출석 목록 조회
- [ ] 통계 표시 (총 예정 인원, 자동 생성, 수동 추가, 취소)
- [ ] 예정 취소 (is_cancelled 토글)
- [ ] 수동 예정 추가 모달
  - [ ] 환자 선택 (드롭다운, 이미 예정된 환자 제외)
  - [ ] 저장 시 scheduled_attendances 추가 (source='manual')
- [ ] 수동 추가 건 삭제 (source='manual'만 삭제 가능)

### P1 (Should Have)

- [ ] 기본 스케줄 일괄 적용 (예: 전체 환자 주5일 패턴 설정)
- [ ] 일일 예정 출석 엑셀 다운로드
- [ ] 날짜 범위로 예정 출석 조회 (주간/월간 뷰)
- [ ] 예정 취소 사유 입력 (memo 필드 추가)

### P2 (Nice to Have)

- [ ] 공휴일 자동 처리 (해당 날짜 자동 취소)
- [ ] 환자 그룹별 패턴 설정 (예: A그룹 월/수/금, B그룹 화/목)
- [ ] 패턴 변경 히스토리 조회

## Data Requirements

### API Endpoints

#### GET /api/admin/schedule/patterns
- **Query Parameters**:
  - `page`: 페이지 번호
  - `limit`: 페이지당 개수
  - `search`: 환자 이름 검색
- **Response**:
  ```typescript
  {
    data: Array<{
      patient_id: string;
      patient_name: string;
      coordinator_name?: string;
      schedule_days: number[]; // [1, 3, 5] for 월/수/금
    }>;
    total: number;
    page: number;
    limit: number;
  }
  ```

#### GET /api/admin/schedule/patterns/:patient_id
- **Response**:
  ```typescript
  {
    patient_id: string;
    patient_name: string;
    schedule_days: number[];
  }
  ```

#### PUT /api/admin/schedule/patterns/:patient_id
- **Request**:
  ```typescript
  {
    schedule_days: number[]; // [0-6]
  }
  ```
- **Response**: `{ success: boolean }`

#### GET /api/admin/schedule/daily
- **Query Parameters**:
  - `date`: YYYY-MM-DD 형식
  - `source`: 'all', 'auto', 'manual'
  - `status`: 'all', 'active', 'cancelled'
- **Response**:
  ```typescript
  {
    date: string;
    stats: {
      total: number;
      auto: number;
      manual: number;
      cancelled: number;
    };
    data: Array<{
      id: string;
      patient_id: string;
      patient_name: string;
      coordinator_name?: string;
      source: 'auto' | 'manual';
      is_cancelled: boolean;
    }>;
  }
  ```

#### POST /api/admin/schedule/daily
- **Request**:
  ```typescript
  {
    date: string; // YYYY-MM-DD
    patient_id: string;
  }
  ```
- **Response**: `ScheduledAttendance`

#### PATCH /api/admin/schedule/daily/:id/cancel
- **Request**:
  ```typescript
  {
    is_cancelled: boolean;
  }
  ```
- **Response**: `ScheduledAttendance`

#### DELETE /api/admin/schedule/daily/:id
- **참고**: source='manual'만 삭제 가능
- **Response**: `{ success: boolean }`

### State Management

#### Server State (React Query)
- `useSchedulePatterns`: 기본 스케줄 목록 조회
- `usePatternDetail`: 환자별 패턴 조회
- `useUpdatePattern`: 패턴 수정 mutation
- `useDailySchedule`: 일일 예정 조회
- `useAddManualSchedule`: 수동 예정 추가 mutation
- `useCancelSchedule`: 예정 취소 mutation
- `useDeleteSchedule`: 수동 예정 삭제 mutation

#### Client State (Zustand)
- `adminScheduleStore`:
  - `activeTab`: 'basic' | 'daily'
  - `selectedDate`: string (YYYY-MM-DD)
  - `filters`: { search, source, status }
  - `pagination`: { page, limit }
  - `selectedPatient`: { id, name } | null
  - `isPatternModalOpen`: boolean
  - `isManualAddModalOpen`: boolean

## Dependencies

### 필요한 컴포넌트
- `shadcn/ui`:
  - `Tabs`
  - `Dialog`
  - `Input`
  - `Checkbox`
  - `Select`
  - `Button`
  - `Badge`
  - `Calendar` (DatePicker)

### 외부 라이브러리
- `@tanstack/react-query`: 서버 상태 관리
- `zustand`: 클라이언트 상태 관리
- `zod`: 폼 유효성 검사
- `react-hook-form`: 폼 관리
- `date-fns`: 날짜 포맷팅, 조작

## Implementation Steps

1. **레이아웃 구성**
   - AdminLayout 재사용
   - 페이지 헤더: "스케줄 관리" + Tab Navigation

2. **기본 스케줄 Tab (Tab 1)**
   - 환자별 패턴 목록 테이블
   - 검색 바 (환자 이름)
   - 출석 패턴 Badge (월,수,금 등)
   - 수정 버튼 → 모달 열기

3. **출석 패턴 수정 모달**
   - 환자 정보 표시 (읽기 전용)
   - 요일 체크박스 그룹 (일~토)
   - 저장 시 기존 scheduled_patterns 삭제 후 재생성

4. **일일 예정 Tab (Tab 2)**
   - 날짜 선택 (DatePicker)
   - 통계 카드 (총 예정, 자동, 수동, 취소)
   - 예정 출석 목록 테이블
   - 필터: 소스(전체/자동/수동), 상태(전체/예정/취소)

5. **수동 예정 추가 모달**
   - 환자 Select (이미 예정된 환자 제외)
   - 저장 시 scheduled_attendances 추가

6. **예정 취소/삭제**
   - 취소: is_cancelled 토글 (PATCH)
   - 삭제: source='manual'만 DELETE

7. **API 연동**
   - Hono 백엔드 라우터 구현
   - React Query 훅 구현
   - Optimistic Update 적용

8. **상태 관리**
   - Zustand 스토어 구현
   - Tab, 날짜, 필터 상태 관리

## Validation Rules

### 출석 패턴 수정

```typescript
const schedulePatternSchema = z.object({
  schedule_days: z.array(z.number().min(0).max(6))
    .min(1, '최소 1개 이상의 요일을 선택해주세요'),
});
```

### 수동 예정 추가

```typescript
const manualScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  patient_id: z.string().uuid('올바른 환자를 선택해주세요'),
});
```

## Business Logic

### 기본 스케줄 업데이트 로직

1. 기존 scheduled_patterns 삭제 (patient_id 기준)
2. 새 패턴 일괄 생성 (schedule_days 배열 순회)
3. 트랜잭션 처리 (all or nothing)

```sql
BEGIN;
DELETE FROM scheduled_patterns WHERE patient_id = :patient_id;
INSERT INTO scheduled_patterns (patient_id, day_of_week) VALUES
  (:patient_id, 1),
  (:patient_id, 3),
  (:patient_id, 5);
COMMIT;
```

### 일일 예정 자동 생성 (cron job)

- 매일 자동 실행 (예: 오전 6시)
- scheduled_patterns 기반으로 scheduled_attendances 생성
- 중복 방지: ON CONFLICT (patient_id, date) DO NOTHING

```sql
INSERT INTO scheduled_attendances (patient_id, date, source)
SELECT
  sp.patient_id,
  CURRENT_DATE,
  'auto'
FROM scheduled_patterns sp
JOIN patients p ON p.id = sp.patient_id
WHERE sp.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)
  AND sp.is_active = true
  AND p.status = 'active'
ON CONFLICT (patient_id, date) DO NOTHING;
```

## Security Considerations

- **권한 확인**: 관리자 역할만 접근 가능
- **날짜 검증**: 과거 날짜 수정 제한 (선택사항)
- **중복 방지**: UNIQUE 제약 활용
- **삭제 제한**: source='auto'는 삭제 불가, 취소만 가능

## Performance Considerations

- **페이지네이션**: 기본 스케줄 목록
- **인덱스 활용**: idx_scheduled_patterns_patient, idx_scheduled_attendances_date
- **React Query Cache**: staleTime 3분
- **Debouncing**: 검색 입력 500ms

## Accessibility

- **키보드 네비게이션**: Tab, Enter 키 지원
- **날짜 선택**: 키보드로 날짜 선택 가능 (화살표 키)
- **Screen Reader**: aria-label, role 속성

---

*문서 버전: 1.0*
*작성일: 2025-01-29*

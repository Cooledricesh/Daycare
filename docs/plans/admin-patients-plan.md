# Admin Patients Page Implementation Plan

## Overview

- **페이지 목적**: 환자 정보 관리 (추가, 수정, 담당 코디 배정, 출석 패턴 설정)
- **PRD 참조**: [Section 7.6 관리자 화면 - 환자 관리](../prd.md#76-관리자-화면-데스크탑)
- **URL**: `/admin/patients`

## Component Hierarchy

```
AdminPatientsPage
├── AdminLayout
│   ├── AdminHeader
│   │   ├── Logo
│   │   └── UserMenu
│   └── AdminSidebar
│       └── NavigationLinks
└── PatientsManagementSection
    ├── PatientsPageHeader
    │   ├── PageTitle
    │   └── AddPatientButton
    ├── PatientsFilterBar
    │   ├── SearchInput
    │   ├── StatusFilter (Dropdown)
    │   └── CoordinatorFilter (Dropdown)
    ├── PatientsTable
    │   ├── TableHeader
    │   └── TableBody
    │       └── PatientRow[]
    │           ├── NameCell
    │           ├── BirthDateCell
    │           ├── CoordinatorCell
    │           ├── SchedulePatternCell
    │           ├── StatusCell
    │           └── ActionsCell
    │               └── EditButton
    ├── Pagination
    └── PatientFormModal
        ├── ModalHeader
        ├── PatientForm
        │   ├── NameField
        │   ├── BirthDateField
        │   ├── GenderRadio
        │   ├── CoordinatorSelect
        │   ├── SchedulePatternCheckboxes
        │   └── MemoTextarea
        └── ModalFooter
            ├── CancelButton
            └── SaveButton
```

## Features by Priority

### P0 (Must Have)

- [ ] 환자 목록 조회 (페이지네이션, 20명/페이지)
- [ ] 환자 검색 (이름 기준)
- [ ] 환자 상태 필터링 (전체/활성/퇴원/중단)
- [ ] 환자 추가 모달
  - [ ] 이름 입력 (필수)
  - [ ] 생년월일 입력
  - [ ] 성별 선택 (M/F)
  - [ ] 담당 코디 배정 (드롭다운)
  - [ ] 출석 패턴 설정 (월~금 체크박스)
  - [ ] 메모 입력
- [ ] 환자 수정 모달 (동일 폼 재사용)
- [ ] 환자 저장 시 patients 및 scheduled_patterns 테이블 업데이트
- [ ] 폼 유효성 검사 (zod)

### P1 (Should Have)

- [ ] 담당 코디 필터링
- [ ] 환자 상태 변경 (활성/퇴원/중단)
- [ ] 출석 패턴 일괄 적용 (예: 주5일, 주3일 템플릿)
- [ ] 환자 정보 엑셀 다운로드 (향후)

### P2 (Nice to Have)

- [ ] 환자 사진 업로드
- [ ] 환자 상세 히스토리 조회 (모달 또는 별도 페이지)
- [ ] 환자 삭제 (soft delete: status='deleted')

## Data Requirements

### API Endpoints

#### GET /api/admin/patients
- **Query Parameters**:
  - `page`: 페이지 번호 (default: 1)
  - `limit`: 페이지당 개수 (default: 20)
  - `search`: 이름 검색어
  - `status`: 상태 필터 ('active', 'discharged', 'suspended', 'all')
  - `coordinator_id`: 담당 코디 필터
- **Response**:
  ```typescript
  {
    data: PatientWithCoordinator[];
    total: number;
    page: number;
    limit: number;
  }
  ```

#### GET /api/admin/patients/:id
- **Response**: `PatientWithCoordinator & { schedule_patterns: ScheduledPattern[] }`

#### POST /api/admin/patients
- **Request**:
  ```typescript
  {
    name: string;
    birth_date?: string;
    gender?: 'M' | 'F';
    coordinator_id?: string;
    memo?: string;
    schedule_days: number[]; // [1, 3, 5] for 월/수/금
  }
  ```
- **Response**: `Patient`

#### PUT /api/admin/patients/:id
- **Request**: 동일 (status 추가 가능)
- **Response**: `Patient`

#### GET /api/admin/coordinators (담당 코디 목록)
- **Response**: `StaffPublic[]` (role='coordinator')

### State Management

#### Server State (React Query)
- `usePatients`: 환자 목록 조회
- `usePatientDetail`: 환자 상세 조회
- `useCoordinators`: 담당 코디 목록 조회
- `useCreatePatient`: 환자 생성 mutation
- `useUpdatePatient`: 환자 수정 mutation

#### Client State (Zustand)
- `adminPatientsStore`:
  - `filters`: { search, status, coordinator_id }
  - `pagination`: { page, limit }
  - `selectedPatient`: Patient | null
  - `isModalOpen`: boolean

## Dependencies

### 필요한 컴포넌트
- `shadcn/ui`:
  - `Table`
  - `Dialog` (모달)
  - `Input`
  - `Select`
  - `Checkbox`
  - `Textarea`
  - `Button`
  - `Label`
  - `RadioGroup`

### 외부 라이브러리
- `@tanstack/react-query`: 서버 상태 관리
- `zustand`: 클라이언트 상태 관리
- `zod`: 폼 유효성 검사
- `react-hook-form`: 폼 관리
- `date-fns`: 날짜 포맷팅

## Implementation Steps

1. **레이아웃 구성**
   - AdminLayout 재사용 (다른 admin 페이지와 공통)
   - 페이지 헤더: "환자 관리" + "환자 추가" 버튼

2. **환자 목록 테이블**
   - shadcn Table 컴포넌트 사용
   - 컬럼: 이름, 생년월일, 담당 코디, 출석 패턴, 상태, 관리
   - 페이지네이션 (< 1 2 3 >)

3. **필터 바**
   - 검색 Input (이름)
   - 상태 Select (전체/활성/퇴원/중단)
   - 담당 코디 Select (전체/특정 코디)

4. **환자 추가/수정 모달**
   - Dialog 컴포넌트 사용
   - react-hook-form + zod 검증
   - 폼 필드:
     - 이름 (required)
     - 생년월일 (date picker)
     - 성별 (RadioGroup)
     - 담당 코디 (Select)
     - 출석 패턴 (Checkbox 그룹: 월~금)
     - 메모 (Textarea)

5. **API 연동**
   - Hono 백엔드 라우터 구현 (`/api/admin/patients`)
   - React Query 훅 구현
   - Optimistic Update 적용 (환자 추가/수정 시)

6. **상태 관리**
   - Zustand 스토어 구현
   - 필터/페이지네이션 상태 관리

## Validation Rules

### 환자 추가/수정 폼

```typescript
const patientFormSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  birth_date: z.string().optional(),
  gender: z.enum(['M', 'F']).optional(),
  coordinator_id: z.string().uuid().optional(),
  memo: z.string().optional(),
  schedule_days: z.array(z.number().min(0).max(6)),
  status: z.enum(['active', 'discharged', 'suspended']).default('active'),
});
```

## Security Considerations

- **권한 확인**: 관리자 역할만 접근 가능 (middleware에서 role='admin' 확인)
- **입력 검증**: 서버 측 zod 검증 필수
- **SQL Injection 방지**: Parameterized queries 사용
- **XSS 방지**: 사용자 입력값 이스케이프 (React 기본 제공)

## Performance Considerations

- **페이지네이션**: 대량 환자 데이터 처리 (250명 → 20명/페이지)
- **인덱스 활용**: idx_patients_name, idx_patients_status, idx_patients_coordinator
- **Debouncing**: 검색 입력 시 500ms debounce
- **React Query Cache**: staleTime 5분

## Accessibility

- **키보드 네비게이션**: Tab, Enter 키 지원
- **Screen Reader**: aria-label, role 속성
- **포커스 관리**: 모달 열 때 첫 입력 필드 자동 포커스

---

*문서 버전: 1.0*
*작성일: 2025-01-29*

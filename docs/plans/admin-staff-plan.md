# Admin Staff Page Implementation Plan

## Overview

- **페이지 목적**: 직원 계정 관리 (추가, 수정, 비활성화, 비밀번호 초기화)
- **PRD 참조**: [Section 2.2 Phase 1 - 인증 + 기본 구조](../prd.md#phase-1-인증--기본-구조-6시간)
- **URL**: `/admin/staff`

## Component Hierarchy

```
AdminStaffPage
├── AdminLayout
│   ├── AdminHeader
│   └── AdminSidebar
└── StaffManagementSection
    ├── StaffPageHeader
    │   ├── PageTitle
    │   └── AddStaffButton
    ├── StaffFilterBar
    │   ├── RoleFilter (Dropdown)
    │   └── StatusFilter (Dropdown)
    ├── StaffTable
    │   ├── TableHeader
    │   └── TableBody
    │       └── StaffRow[]
    │           ├── NameCell
    │           ├── LoginIdCell
    │           ├── RoleCell
    │           ├── StatusCell
    │           └── ActionsCell
    │               ├── EditButton
    │               └── ResetPasswordButton
    ├── Pagination
    ├── StaffFormModal
    │   ├── ModalHeader
    │   ├── StaffForm
    │   │   ├── NameField
    │   │   ├── LoginIdField
    │   │   ├── PasswordField (추가 시만)
    │   │   ├── RoleSelect
    │   │   └── StatusRadio (수정 시만)
    │   └── ModalFooter
    │       ├── CancelButton
    │       └── SaveButton
    └── PasswordResetModal
        ├── ModalHeader
        ├── PasswordResetForm
        │   ├── NewPasswordField
        │   └── ConfirmPasswordField
        └── ModalFooter
            ├── CancelButton
            └── ResetButton
```

## Features by Priority

### P0 (Must Have)

- [ ] 직원 목록 조회 (페이지네이션, 20명/페이지)
- [ ] 역할 필터링 (전체/의사/코디/간호사/관리자)
- [ ] 상태 필터링 (전체/활성/비활성)
- [ ] 직원 추가 모달
  - [ ] 이름 입력 (필수)
  - [ ] 로그인 ID 입력 (필수, unique)
  - [ ] 비밀번호 입력 (필수, 8자 이상)
  - [ ] 역할 선택 (필수)
- [ ] 직원 수정 모달
  - [ ] 이름, 역할, 상태 수정 가능
  - [ ] 로그인 ID 수정 불가 (읽기 전용)
- [ ] 비밀번호 초기화 모달
  - [ ] 새 비밀번호 입력
  - [ ] 비밀번호 확인 입력
- [ ] 폼 유효성 검사 (zod)

### P1 (Should Have)

- [ ] 직원 비활성화/활성화 토글
- [ ] 직원 검색 (이름, 로그인 ID)
- [ ] 직원 역할별 통계 (의사 N명, 코디 N명 등)

### P2 (Nice to Have)

- [ ] 직원 삭제 (soft delete: is_active=false)
- [ ] 직원 활동 로그 조회
- [ ] 비밀번호 변경 히스토리

## Data Requirements

### API Endpoints

#### GET /api/admin/staff
- **Query Parameters**:
  - `page`: 페이지 번호 (default: 1)
  - `limit`: 페이지당 개수 (default: 20)
  - `role`: 역할 필터 ('doctor', 'coordinator', 'nurse', 'admin', 'all')
  - `status`: 상태 필터 ('active', 'inactive', 'all')
- **Response**:
  ```typescript
  {
    data: StaffPublic[];
    total: number;
    page: number;
    limit: number;
  }
  ```

#### GET /api/admin/staff/:id
- **Response**: `StaffPublic`

#### POST /api/admin/staff
- **Request**:
  ```typescript
  {
    name: string;
    login_id: string;
    password: string;
    role: 'doctor' | 'coordinator' | 'nurse' | 'admin';
  }
  ```
- **Response**: `StaffPublic`

#### PUT /api/admin/staff/:id
- **Request**:
  ```typescript
  {
    name?: string;
    role?: 'doctor' | 'coordinator' | 'nurse' | 'admin';
    is_active?: boolean;
  }
  ```
- **Response**: `StaffPublic`

#### POST /api/admin/staff/:id/reset-password
- **Request**:
  ```typescript
  {
    new_password: string;
  }
  ```
- **Response**: `{ success: boolean }`

### State Management

#### Server State (React Query)
- `useStaffList`: 직원 목록 조회
- `useStaffDetail`: 직원 상세 조회
- `useCreateStaff`: 직원 생성 mutation
- `useUpdateStaff`: 직원 수정 mutation
- `useResetPassword`: 비밀번호 초기화 mutation

#### Client State (Zustand)
- `adminStaffStore`:
  - `filters`: { role, status }
  - `pagination`: { page, limit }
  - `selectedStaff`: StaffPublic | null
  - `isFormModalOpen`: boolean
  - `isPasswordResetModalOpen`: boolean

## Dependencies

### 필요한 컴포넌트
- `shadcn/ui`:
  - `Table`
  - `Dialog`
  - `Input`
  - `Select`
  - `RadioGroup`
  - `Button`
  - `Label`
  - `Badge` (역할, 상태 표시)

### 외부 라이브러리
- `@tanstack/react-query`: 서버 상태 관리
- `zustand`: 클라이언트 상태 관리
- `zod`: 폼 유효성 검사
- `react-hook-form`: 폼 관리
- `bcrypt` (서버): 비밀번호 해싱

## Implementation Steps

1. **레이아웃 구성**
   - AdminLayout 재사용
   - 페이지 헤더: "직원 관리" + "직원 추가" 버튼

2. **직원 목록 테이블**
   - shadcn Table 컴포넌트 사용
   - 컬럼: 이름, 로그인 ID, 역할, 상태, 관리
   - 역할 Badge (색상 구분: doctor=파랑, coordinator=초록, nurse=주황, admin=빨강)
   - 상태 Badge (active=초록, inactive=회색)

3. **필터 바**
   - 역할 Select (전체/의사/코디/간호사/관리자)
   - 상태 Select (전체/활성/비활성)

4. **직원 추가 모달**
   - Dialog 컴포넌트 사용
   - react-hook-form + zod 검증
   - 폼 필드:
     - 이름 (required)
     - 로그인 ID (required, unique 검증)
     - 비밀번호 (required, 8자 이상)
     - 역할 (required, Select)

5. **직원 수정 모달**
   - 동일 폼 재사용 (mode='edit')
   - 로그인 ID 읽기 전용
   - 비밀번호 필드 제거 (별도 초기화 모달 사용)
   - 상태 RadioGroup 추가

6. **비밀번호 초기화 모달**
   - 새 비밀번호 입력
   - 비밀번호 확인 입력
   - 일치 여부 검증

7. **API 연동**
   - Hono 백엔드 라우터 구현 (`/api/admin/staff`)
   - bcrypt 해싱 적용 (서버 측)
   - React Query 훅 구현

8. **상태 관리**
   - Zustand 스토어 구현
   - 필터/페이지네이션 상태 관리

## Validation Rules

### 직원 추가 폼

```typescript
const staffCreateSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  login_id: z.string()
    .min(4, '로그인 ID는 4자 이상이어야 합니다')
    .max(50, '로그인 ID는 50자 이하이어야 합니다')
    .regex(/^[a-zA-Z0-9_]+$/, '영문, 숫자, _만 사용 가능합니다'),
  password: z.string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(100, '비밀번호는 100자 이하이어야 합니다'),
  role: z.enum(['doctor', 'coordinator', 'nurse', 'admin']),
});
```

### 직원 수정 폼

```typescript
const staffUpdateSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  role: z.enum(['doctor', 'coordinator', 'nurse', 'admin']),
  is_active: z.boolean(),
});
```

### 비밀번호 초기화 폼

```typescript
const passwordResetSchema = z.object({
  new_password: z.string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(100, '비밀번호는 100자 이하이어야 합니다'),
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirm_password'],
});
```

## Security Considerations

- **권한 확인**: 관리자 역할만 접근 가능
- **비밀번호 해싱**: bcrypt (saltRounds=10)
- **password_hash 노출 금지**: API 응답에서 제외 (StaffPublic 타입 사용)
- **로그인 ID 중복 검증**: DB unique 제약 + 서버 측 검증
- **본인 계정 비활성화 방지**: 로그인한 관리자 본인은 비활성화 불가

## Performance Considerations

- **페이지네이션**: 대량 직원 데이터 처리
- **인덱스 활용**: idx_staff_login_id, idx_staff_role
- **React Query Cache**: staleTime 5분

## Accessibility

- **키보드 네비게이션**: Tab, Enter 키 지원
- **Screen Reader**: aria-label, role 속성
- **포커스 관리**: 모달 열 때 첫 입력 필드 자동 포커스

---

*문서 버전: 1.0*
*작성일: 2025-01-29*

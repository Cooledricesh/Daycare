# Admin Pages Technical Specification

## Overview

관리자용 페이지 4개 (`/admin/patients`, `/admin/staff`, `/admin/schedule`, `/admin/stats`)의 기술적 요구사항을 정의합니다.

---

## 1. API Endpoints

### 1.1 Patients API

#### GET /api/admin/patients

**Purpose**: 환자 목록 조회 (페이지네이션, 검색, 필터링)

**Request**:
```typescript
interface GetPatientsRequest {
  page?: number; // default: 1
  limit?: number; // default: 20
  search?: string; // 이름 검색
  status?: 'active' | 'discharged' | 'suspended' | 'all'; // default: 'all'
  coordinator_id?: string; // UUID
}
```

**Response**:
```typescript
interface GetPatientsResponse {
  data: Array<{
    id: string;
    name: string;
    birth_date: string | null;
    gender: 'M' | 'F' | null;
    coordinator_id: string | null;
    coordinator_name: string | null;
    status: 'active' | 'discharged' | 'suspended';
    memo: string | null;
    created_at: string;
    updated_at: string;
    schedule_pattern: string; // "월,수,금" 형태
  }>;
  total: number;
  page: number;
  limit: number;
}
```

**Error Codes**:
- 400: Bad Request (잘못된 파라미터)
- 401: Unauthorized (인증 실패)
- 403: Forbidden (관리자 아님)

---

#### GET /api/admin/patients/:id

**Purpose**: 환자 상세 조회

**Response**:
```typescript
interface GetPatientDetailResponse {
  id: string;
  name: string;
  birth_date: string | null;
  gender: 'M' | 'F' | null;
  coordinator_id: string | null;
  coordinator_name: string | null;
  status: 'active' | 'discharged' | 'suspended';
  memo: string | null;
  created_at: string;
  updated_at: string;
  schedule_patterns: Array<{
    id: string;
    day_of_week: number; // 0-6
    is_active: boolean;
  }>;
}
```

**Error Codes**:
- 404: Not Found (환자 없음)

---

#### POST /api/admin/patients

**Purpose**: 환자 추가

**Request**:
```typescript
interface CreatePatientRequest {
  name: string; // required
  birth_date?: string; // YYYY-MM-DD
  gender?: 'M' | 'F';
  coordinator_id?: string; // UUID
  memo?: string;
  schedule_days: number[]; // [1, 3, 5] for 월/수/금
}
```

**Response**:
```typescript
interface CreatePatientResponse {
  id: string;
  name: string;
  birth_date: string | null;
  gender: 'M' | 'F' | null;
  coordinator_id: string | null;
  status: 'active';
  memo: string | null;
  created_at: string;
  updated_at: string;
}
```

**Validation**:
- `name`: 1자 이상 100자 이하
- `birth_date`: YYYY-MM-DD 형식 (optional)
- `gender`: 'M' | 'F' (optional)
- `coordinator_id`: UUID 형식 (optional)
- `schedule_days`: 0-6 범위의 숫자 배열

**Error Codes**:
- 400: Bad Request (유효성 검사 실패)
- 500: Internal Server Error (DB 오류)

---

#### PUT /api/admin/patients/:id

**Purpose**: 환자 정보 수정

**Request**:
```typescript
interface UpdatePatientRequest {
  name?: string;
  birth_date?: string;
  gender?: 'M' | 'F';
  coordinator_id?: string;
  status?: 'active' | 'discharged' | 'suspended';
  memo?: string;
  schedule_days?: number[];
}
```

**Response**: `CreatePatientResponse`와 동일

**Error Codes**:
- 404: Not Found
- 400: Bad Request

---

### 1.2 Staff API

#### GET /api/admin/staff

**Purpose**: 직원 목록 조회

**Request**:
```typescript
interface GetStaffRequest {
  page?: number;
  limit?: number;
  role?: 'doctor' | 'coordinator' | 'nurse' | 'admin' | 'all';
  status?: 'active' | 'inactive' | 'all';
}
```

**Response**:
```typescript
interface GetStaffResponse {
  data: Array<{
    id: string;
    login_id: string;
    name: string;
    role: 'doctor' | 'coordinator' | 'nurse' | 'admin';
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
  page: number;
  limit: number;
}
```

---

#### POST /api/admin/staff

**Purpose**: 직원 추가

**Request**:
```typescript
interface CreateStaffRequest {
  name: string;
  login_id: string; // unique
  password: string; // 8자 이상
  role: 'doctor' | 'coordinator' | 'nurse' | 'admin';
}
```

**Response**:
```typescript
interface CreateStaffResponse {
  id: string;
  login_id: string;
  name: string;
  role: 'doctor' | 'coordinator' | 'nurse' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Validation**:
- `name`: 1자 이상
- `login_id`: 4-50자, 영문/숫자/_만 허용, unique
- `password`: 8-100자
- `role`: enum 검증

**Error Codes**:
- 400: Bad Request (중복 login_id)
- 409: Conflict (login_id 이미 존재)

---

#### PUT /api/admin/staff/:id

**Purpose**: 직원 정보 수정

**Request**:
```typescript
interface UpdateStaffRequest {
  name?: string;
  role?: 'doctor' | 'coordinator' | 'nurse' | 'admin';
  is_active?: boolean;
}
```

**Response**: `CreateStaffResponse`와 동일

---

#### POST /api/admin/staff/:id/reset-password

**Purpose**: 비밀번호 초기화

**Request**:
```typescript
interface ResetPasswordRequest {
  new_password: string; // 8자 이상
}
```

**Response**:
```typescript
interface ResetPasswordResponse {
  success: boolean;
}
```

**Validation**:
- `new_password`: 8-100자

---

### 1.3 Schedule API

#### GET /api/admin/schedule/patterns

**Purpose**: 환자별 기본 출석 패턴 조회

**Request**:
```typescript
interface GetSchedulePatternsRequest {
  page?: number;
  limit?: number;
  search?: string; // 환자 이름
}
```

**Response**:
```typescript
interface GetSchedulePatternsResponse {
  data: Array<{
    patient_id: string;
    patient_name: string;
    coordinator_name: string | null;
    schedule_days: number[]; // [1, 3, 5]
  }>;
  total: number;
  page: number;
  limit: number;
}
```

---

#### PUT /api/admin/schedule/patterns/:patient_id

**Purpose**: 환자 출석 패턴 수정

**Request**:
```typescript
interface UpdateSchedulePatternRequest {
  schedule_days: number[]; // 0-6
}
```

**Response**:
```typescript
interface UpdateSchedulePatternResponse {
  success: boolean;
}
```

**Business Logic**:
1. 기존 scheduled_patterns 삭제 (patient_id 기준)
2. 새 패턴 일괄 생성 (schedule_days 순회)
3. 트랜잭션 처리

---

#### GET /api/admin/schedule/daily

**Purpose**: 일일 예정 출석 조회

**Request**:
```typescript
interface GetDailyScheduleRequest {
  date: string; // YYYY-MM-DD
  source?: 'all' | 'auto' | 'manual';
  status?: 'all' | 'active' | 'cancelled';
}
```

**Response**:
```typescript
interface GetDailyScheduleResponse {
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
    coordinator_name: string | null;
    source: 'auto' | 'manual';
    is_cancelled: boolean;
    created_at: string;
  }>;
}
```

---

#### POST /api/admin/schedule/daily

**Purpose**: 수동 예정 출석 추가

**Request**:
```typescript
interface AddManualScheduleRequest {
  date: string; // YYYY-MM-DD
  patient_id: string;
}
```

**Response**:
```typescript
interface AddManualScheduleResponse {
  id: string;
  patient_id: string;
  date: string;
  source: 'manual';
  is_cancelled: false;
  created_at: string;
}
```

**Error Codes**:
- 409: Conflict (이미 예정된 환자)

---

#### PATCH /api/admin/schedule/daily/:id/cancel

**Purpose**: 예정 출석 취소/복원

**Request**:
```typescript
interface CancelScheduleRequest {
  is_cancelled: boolean;
}
```

**Response**:
```typescript
interface CancelScheduleResponse {
  id: string;
  is_cancelled: boolean;
}
```

---

#### DELETE /api/admin/schedule/daily/:id

**Purpose**: 수동 예정 출석 삭제

**Response**:
```typescript
interface DeleteScheduleResponse {
  success: boolean;
}
```

**Validation**:
- source='manual'만 삭제 가능 (source='auto'는 403)

---

### 1.4 Stats API

#### GET /api/admin/stats/summary

**Purpose**: 기간별 통계 요약

**Request**:
```typescript
interface GetStatsSummaryRequest {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}
```

**Response**:
```typescript
interface GetStatsSummaryResponse {
  period: {
    start: string;
    end: string;
  };
  average_attendance_rate: number; // %
  average_consultation_rate: number; // %
  total_scheduled: number;
  total_attendance: number;
  total_consultation: number;
  today: {
    scheduled: number;
    attendance: number;
    consultation: number;
  };
  previous_period: {
    average_attendance_rate: number;
    average_consultation_rate: number;
  };
}
```

---

#### GET /api/admin/stats/daily

**Purpose**: 일별 통계 조회

**Request**:
```typescript
interface GetDailyStatsRequest {
  start_date: string;
  end_date: string;
}
```

**Response**:
```typescript
interface GetDailyStatsResponse {
  data: Array<{
    id: string;
    date: string;
    scheduled_count: number;
    attendance_count: number;
    consultation_count: number;
    attendance_rate: number; // %
    consultation_rate: number; // %
    calculated_at: string;
  }>;
}
```

---

## 2. Components

### 2.1 Common Components

#### AdminLayout

**Props**:
```typescript
interface AdminLayoutProps {
  children: React.ReactNode;
}
```

**State**: 없음 (레이아웃만 제공)

**Behavior**:
- 헤더: 로고, 페이지 타이틀, 사용자 메뉴
- 사이드바: 내비게이션 링크 (환자관리, 직원관리, 스케줄관리, 통계)
- 콘텐츠 영역: children 렌더링

---

#### PatientFormModal

**Props**:
```typescript
interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  patient?: Patient;
  onSuccess: () => void;
}
```

**State**:
```typescript
interface PatientFormState {
  name: string;
  birth_date: string;
  gender: 'M' | 'F' | '';
  coordinator_id: string;
  memo: string;
  schedule_days: number[];
}
```

**Behavior**:
- mode='create': 빈 폼
- mode='edit': patient 데이터로 초기화
- 저장 시: useCreatePatient 또는 useUpdatePatient mutation 실행
- 성공 시: onSuccess 콜백 + 모달 닫기

---

#### StaffFormModal

**Props**:
```typescript
interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  staff?: StaffPublic;
  onSuccess: () => void;
}
```

**State**:
```typescript
interface StaffFormState {
  name: string;
  login_id: string; // edit 시 읽기 전용
  password?: string; // create 시만
  role: 'doctor' | 'coordinator' | 'nurse' | 'admin';
  is_active?: boolean; // edit 시만
}
```

**Behavior**:
- mode='create': 비밀번호 필드 표시
- mode='edit': login_id 읽기 전용, 비밀번호 필드 제거
- 저장 시: useCreateStaff 또는 useUpdateStaff mutation 실행

---

#### PasswordResetModal

**Props**:
```typescript
interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
  onSuccess: () => void;
}
```

**State**:
```typescript
interface PasswordResetFormState {
  new_password: string;
  confirm_password: string;
}
```

**Behavior**:
- 비밀번호 일치 검증
- 저장 시: useResetPassword mutation 실행

---

### 2.2 Page-Specific Components

#### PatientsTable

**Props**:
```typescript
interface PatientsTableProps {
  patients: PatientWithCoordinator[];
  onEdit: (patient: PatientWithCoordinator) => void;
}
```

**Behavior**:
- 환자 목록 테이블 렌더링
- 수정 버튼 클릭 시 onEdit 콜백

---

#### StatsChart

**Props**:
```typescript
interface StatsChartProps {
  data: DailyStats[];
  metric: 'attendance_rate' | 'consultation_rate' | 'both';
}
```

**Behavior**:
- recharts LineChart 사용
- metric에 따라 라인 표시 (both: 2개 라인)

---

## 3. Validation Rules

### 3.1 Zod Schemas

#### Patient Schema

```typescript
export const patientFormSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이하이어야 합니다'),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다').optional().or(z.literal('')),
  gender: z.enum(['M', 'F', '']).optional(),
  coordinator_id: z.string().uuid('올바른 담당 코디를 선택해주세요').optional().or(z.literal('')),
  memo: z.string().max(500, '메모는 500자 이하이어야 합니다').optional(),
  schedule_days: z.array(z.number().min(0).max(6)).min(0, '출석 패턴을 선택해주세요'),
});

export type PatientFormData = z.infer<typeof patientFormSchema>;
```

---

#### Staff Schema

```typescript
export const staffCreateSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이하이어야 합니다'),
  login_id: z.string()
    .min(4, '로그인 ID는 4자 이상이어야 합니다')
    .max(50, '로그인 ID는 50자 이하이어야 합니다')
    .regex(/^[a-zA-Z0-9_]+$/, '영문, 숫자, _만 사용 가능합니다'),
  password: z.string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(100, '비밀번호는 100자 이하이어야 합니다'),
  role: z.enum(['doctor', 'coordinator', 'nurse', 'admin']),
});

export const staffUpdateSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  role: z.enum(['doctor', 'coordinator', 'nurse', 'admin']),
  is_active: z.boolean(),
});

export type StaffCreateData = z.infer<typeof staffCreateSchema>;
export type StaffUpdateData = z.infer<typeof staffUpdateSchema>;
```

---

#### Password Reset Schema

```typescript
export const passwordResetSchema = z.object({
  new_password: z.string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(100, '비밀번호는 100자 이하이어야 합니다'),
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirm_password'],
});

export type PasswordResetData = z.infer<typeof passwordResetSchema>;
```

---

## 4. Security Considerations

### 4.1 인증 및 권한

- **Middleware**: 모든 `/api/admin/*` 엔드포인트는 role='admin' 확인 필수
- **JWT 검증**: httpOnly 쿠키에서 토큰 추출 후 검증
- **본인 계정 보호**: 로그인한 관리자 본인은 비활성화 불가

### 4.2 입력 검증

- **클라이언트**: zod 스키마로 즉시 검증
- **서버**: 동일한 zod 스키마로 재검증
- **SQL Injection**: Parameterized queries (Supabase 기본 제공)
- **XSS**: React 기본 이스케이프

### 4.3 비밀번호 관리

- **해싱**: bcrypt (saltRounds=10)
- **password_hash 노출 금지**: API 응답에서 제외 (StaffPublic 타입)
- **초기 비밀번호**: 관리자가 직접 입력 (자동 생성 X)

---

## 5. Performance Optimization

### 5.1 페이지네이션

- 기본 limit: 20개/페이지
- 최대 limit: 100개/페이지

### 5.2 React Query 설정

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      cacheTime: 10 * 60 * 1000, // 10분
      refetchOnWindowFocus: false,
    },
  },
});
```

### 5.3 Debouncing

- 검색 입력: 500ms debounce
- 필터 변경: 즉시 반영

---

## 6. Error Handling

### 6.1 에러 코드 매핑

```typescript
const ERROR_MESSAGES: Record<number, string> = {
  400: '입력값을 확인해주세요',
  401: '로그인이 필요합니다',
  403: '접근 권한이 없습니다',
  404: '요청하신 정보를 찾을 수 없습니다',
  409: '이미 존재하는 데이터입니다',
  500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
};
```

### 6.2 사용자 친화적 메시지

```typescript
// 중복 login_id 오류
if (error.code === 'P2002' && error.meta?.target?.includes('login_id')) {
  throw new Error('이미 사용 중인 로그인 ID입니다');
}

// 외래키 제약 오류 (coordinator_id)
if (error.code === 'P2003') {
  throw new Error('존재하지 않는 담당 코디입니다');
}
```

---

*문서 버전: 1.0*
*작성일: 2025-01-29*

# Staff (담당 코디) Technical Specification

## Overview

담당 코디 페이지의 기술적 요구사항, API 계약, 컴포넌트 타입 정의, 유효성 검사 규칙을 정의합니다.

---

## API Endpoints

### 1. GET `/api/staff/my-patients`

**Purpose**: 로그인한 코디의 담당 환자 목록 조회

**Authentication**: Required (role='coordinator')

**Query Parameters**:
```typescript
interface MyPatientsQuery {
  date?: string; // YYYY-MM-DD, 기본값: 오늘
}
```

**Request**:
```http
GET /api/staff/my-patients?date=2025-01-29
Authorization: Bearer {JWT_TOKEN}
```

**Response** (200 OK):
```typescript
interface MyPatientsResponse {
  patients: Array<{
    id: string;
    name: string;
    birth_date: string | null;
    gender: 'M' | 'F' | null;
    attendance: {
      is_attended: boolean;
      checked_at: string | null; // ISO 8601 timestamp
    };
    consultation: {
      is_consulted: boolean;
      has_task: boolean;
      task_completed: boolean;
    };
  }>;
  summary: {
    total: number;
    attended: number;
    consulted: number;
    pending_tasks: number;
  };
}
```

**Error Codes**:
- `401 Unauthorized`: 인증 토큰 없음 또는 만료
- `403 Forbidden`: 역할이 'coordinator'가 아님
- `500 Internal Server Error`: 서버 오류

**SQL Query** (참고):
```sql
SELECT
  p.*,
  a.checked_at AS attendance_time,
  c.id AS consultation_id,
  c.has_task,
  COALESCE(
    (SELECT bool_and(tc.is_completed)
     FROM task_completions tc
     WHERE tc.consultation_id = c.id
     AND tc.role = 'coordinator'),
    true
  ) AS task_completed
FROM patients p
LEFT JOIN attendances a ON a.patient_id = p.id AND a.date = :date
LEFT JOIN consultations c ON c.patient_id = p.id AND c.date = :date
WHERE p.coordinator_id = :coordinator_id
  AND p.status = 'active'
ORDER BY p.name;
```

---

### 2. GET `/api/staff/patient/:id`

**Purpose**: 특정 환자의 상세 정보 조회 (오늘 날짜 기준)

**Authentication**: Required (role='coordinator')

**Path Parameters**:
- `id`: 환자 UUID

**Query Parameters**:
```typescript
interface PatientDetailQuery {
  date?: string; // YYYY-MM-DD, 기본값: 오늘
  include_history?: boolean; // 기본값: true
}
```

**Request**:
```http
GET /api/staff/patient/{patient_id}?include_history=true
Authorization: Bearer {JWT_TOKEN}
```

**Response** (200 OK):
```typescript
interface PatientDetailResponse {
  patient: {
    id: string;
    name: string;
    birth_date: string | null;
    gender: 'M' | 'F' | null;
  };
  today: {
    attendance: {
      is_attended: boolean;
      checked_at: string | null;
    };
    consultation: {
      is_consulted: boolean;
      note: string | null;
      doctor_name: string | null;
      created_at: string | null;
    };
    vitals: {
      systolic: number | null;
      diastolic: number | null;
      blood_sugar: number | null;
      recorded_at: string | null;
    } | null;
    task: {
      id: string;
      content: string;
      is_completed: boolean;
      completed_at: string | null;
      completed_by_name: string | null;
    } | null;
  };
  history: Array<{
    date: string;
    note: string;
    doctor_name: string;
    has_task: boolean;
  }>;
}
```

**Error Codes**:
- `401 Unauthorized`: 인증 토큰 없음 또는 만료
- `403 Forbidden`: 담당 환자가 아님
- `404 Not Found`: 환자를 찾을 수 없음
- `500 Internal Server Error`: 서버 오류

**Authorization Check**:
```typescript
// 담당 환자 확인
const patient = await db.patients.findOne({ id: patientId });
if (patient.coordinator_id !== currentUser.id) {
  throw new ForbiddenError('담당 환자가 아닙니다');
}
```

---

### 3. POST `/api/staff/task/:taskId/complete`

**Purpose**: 지시사항 처리 완료 체크

**Authentication**: Required (role='coordinator')

**Path Parameters**:
- `taskId`: task_completions.id (UUID)

**Request Body**:
```typescript
interface CompleteTaskRequest {
  memo?: string; // 처리 메모 (선택, 최대 500자)
}
```

**Request**:
```http
POST /api/staff/task/{task_id}/complete
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "memo": "처방전 발급 완료"
}
```

**Response** (200 OK):
```typescript
interface CompleteTaskResponse {
  success: true;
  completed_at: string; // ISO 8601 timestamp
}
```

**Error Codes**:
- `400 Bad Request`: 이미 처리 완료된 항목
- `401 Unauthorized`: 인증 토큰 없음 또는 만료
- `403 Forbidden`: 본인 담당 환자의 task가 아님
- `404 Not Found`: task를 찾을 수 없음
- `500 Internal Server Error`: 서버 오류

**Business Logic**:
```typescript
// task_completions 업데이트
UPDATE task_completions
SET
  is_completed = true,
  completed_at = NOW(),
  memo = :memo
WHERE id = :taskId
  AND role = 'coordinator'
  AND completed_by = :currentUserId;
```

---

### 4. POST `/api/staff/messages`

**Purpose**: 의사에게 전달사항 작성

**Authentication**: Required (role='coordinator')

**Request Body**:
```typescript
interface CreateMessageRequest {
  patient_id: string; // UUID
  content: string; // 최소 1자, 최대 2000자
  date?: string; // YYYY-MM-DD, 기본값: 오늘
}
```

**Request**:
```http
POST /api/staff/messages
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "patient_id": "uuid-here",
  "content": "어제 저녁 불면 심해 전화 옴. 수면제 증량 검토 요청드립니다.",
  "date": "2025-01-29"
}
```

**Response** (201 Created):
```typescript
interface CreateMessageResponse {
  success: true;
  message: {
    id: string;
    patient_id: string;
    content: string;
    created_at: string;
  };
}
```

**Error Codes**:
- `400 Bad Request`: 유효성 검사 실패 (내용 누락, 환자 ID 누락 등)
- `401 Unauthorized`: 인증 토큰 없음 또는 만료
- `403 Forbidden`: 담당 환자가 아님
- `404 Not Found`: 환자를 찾을 수 없음
- `500 Internal Server Error`: 서버 오류

**Validation Rules**:
- `patient_id`: 필수, UUID 형식
- `content`: 필수, 1자 이상 2000자 이하
- `date`: 선택, YYYY-MM-DD 형식

---

### 5. GET `/api/staff/messages/recent` (선택적)

**Purpose**: 최근 작성한 전달사항 목록 조회

**Authentication**: Required (role='coordinator')

**Query Parameters**:
```typescript
interface RecentMessagesQuery {
  limit?: number; // 기본값: 10, 최대 50
}
```

**Request**:
```http
GET /api/staff/messages/recent?limit=10
Authorization: Bearer {JWT_TOKEN}
```

**Response** (200 OK):
```typescript
interface RecentMessagesResponse {
  messages: Array<{
    id: string;
    patient_id: string;
    patient_name: string;
    content: string;
    created_at: string;
    is_read: boolean;
    read_at: string | null;
  }>;
}
```

**Error Codes**:
- `401 Unauthorized`: 인증 토큰 없음 또는 만료
- `500 Internal Server Error`: 서버 오류

---

## Components

### StaffLayout

**Purpose**: 담당 코디 페이지 공통 레이아웃

**Props**:
```typescript
interface StaffLayoutProps {
  children: React.ReactNode;
  title?: string; // 페이지 제목 (선택)
}
```

**Behavior**:
- 인증 확인 (role='coordinator')
- 미인증 시 `/login`으로 리다이렉트
- 역할 불일치 시 역할별 첫 페이지로 리다이렉트
- Header, MobileNav 포함
- 모바일에서 햄버거 메뉴 표시

---

### DashboardPage

**Purpose**: 담당 환자 대시보드

**State**:
```typescript
interface DashboardState {
  date: string; // YYYY-MM-DD, 기본값: 오늘
  isLoading: boolean;
  error: Error | null;
}
```

**Behavior**:
- 마운트 시 `useMyPatients` 훅으로 데이터 fetch
- 1분마다 자동 refetch (폴링)
- Pull-to-refresh 지원 (모바일)
- 에러 시 재시도 버튼 표시

---

### PatientCard

**Purpose**: 환자 카드 (대시보드 목록 아이템)

**Props**:
```typescript
interface PatientCardProps {
  patient: {
    id: string;
    name: string;
    birth_date: string | null;
    gender: 'M' | 'F' | null;
    attendance: {
      is_attended: boolean;
      checked_at: string | null;
    };
    consultation: {
      is_consulted: boolean;
      has_task: boolean;
      task_completed: boolean;
    };
  };
  onClick: (patientId: string) => void;
}
```

**Behavior**:
- 클릭 시 `/staff/patient/[id]`로 이동
- 출석 상태 아이콘 표시 (✓/✗)
- 진찰 상태 아이콘 표시 (✓/⏳)
- 처리 필요 지시사항 있으면 🔔 표시

---

### PatientDetailPage

**Purpose**: 환자 상세 페이지

**State**:
```typescript
interface PatientDetailState {
  messageContent: string; // 전달사항 입력 내용
  isHistoryExpanded: boolean; // 히스토리 섹션 펼침 상태
  isSubmittingMessage: boolean;
  isCompletingTask: boolean;
}
```

**Behavior**:
- 마운트 시 `usePatientDetail` 훅으로 데이터 fetch
- 뒤로가기 버튼 클릭 시 `/staff/dashboard`로 이동
- 전달사항 전송 후 입력창 초기화 및 성공 토스트 표시
- 지시사항 처리 완료 후 데이터 refetch

---

### TaskSection

**Purpose**: 지시사항 섹션 (조건부 렌더링)

**Props**:
```typescript
interface TaskSectionProps {
  task: {
    id: string;
    content: string;
    is_completed: boolean;
    completed_at: string | null;
    completed_by_name: string | null;
  };
  onComplete: (taskId: string) => Promise<void>;
}
```

**Behavior**:
- 처리 완료된 경우 완료 표시 및 완료 시각/담당자 표시
- 미완료인 경우 "처리 완료 체크" 버튼 표시
- 버튼 클릭 시 확인 다이얼로그 표시
- 처리 완료 후 버튼 비활성화 및 성공 토스트 표시

---

### MessageForm

**Purpose**: 전달사항 작성 폼

**Props**:
```typescript
interface MessageFormProps {
  patientId?: string; // 환자 ID (환자 상세 페이지에서는 필수)
  onSubmit: (data: { patient_id: string; content: string }) => Promise<void>;
  showPatientSelect?: boolean; // 환자 선택 드롭다운 표시 여부
}
```

**State**:
```typescript
interface MessageFormState {
  selectedPatientId: string;
  content: string;
  isSubmitting: boolean;
}
```

**Behavior**:
- react-hook-form + zod로 유효성 검사
- 내용 필수, 1자 이상 2000자 이하
- 전송 중 버튼 비활성화
- 전송 성공 시 폼 초기화
- 전송 실패 시 에러 메시지 표시

**Validation Schema**:
```typescript
import { z } from 'zod';

const messageSchema = z.object({
  patient_id: z.string().uuid('환자를 선택해주세요'),
  content: z.string()
    .min(1, '전달사항 내용을 입력해주세요')
    .max(2000, '전달사항은 2000자 이하로 입력해주세요'),
});

type MessageFormData = z.infer<typeof messageSchema>;
```

---

### HistorySection

**Purpose**: 최근 진찰 기록 섹션 (접기/펼치기)

**Props**:
```typescript
interface HistorySectionProps {
  history: Array<{
    date: string;
    note: string;
    doctor_name: string;
    has_task: boolean;
  }>;
  initialExpanded?: boolean; // 기본값: false
}
```

**State**:
```typescript
interface HistorySectionState {
  isExpanded: boolean;
}
```

**Behavior**:
- 헤더 클릭 시 펼침/접힘 토글
- 접힌 상태에서는 "최근 기록 (N건)" 표시
- 펼친 상태에서는 날짜별 진찰 기록 리스트 표시
- 기록이 없는 경우 "최근 기록이 없습니다" 표시

---

## Validation Rules

### Message Form
```typescript
const messageValidationRules = {
  patient_id: {
    required: true,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    message: '환자를 선택해주세요',
  },
  content: {
    required: true,
    minLength: 1,
    maxLength: 2000,
    message: '전달사항 내용을 1자 이상 2000자 이하로 입력해주세요',
  },
};
```

### Task Completion
```typescript
const taskCompletionValidationRules = {
  memo: {
    required: false,
    maxLength: 500,
    message: '메모는 500자 이하로 입력해주세요',
  },
};
```

---

## Security Considerations

### Authorization
1. **담당 환자 확인**: 모든 환자 관련 API에서 `coordinator_id` 일치 확인
2. **Role 검증**: 모든 `/api/staff/*` 엔드포인트에서 `role='coordinator'` 확인
3. **JWT 검증**: 만료된 토큰 거부, httpOnly 쿠키 사용

### Input Sanitization
1. **XSS 방지**: 전달사항 내용 HTML escape
2. **SQL Injection 방지**: Prepared statements 사용
3. **UUID 검증**: 모든 ID 파라미터 UUID 형식 확인

### Rate Limiting
- POST 요청: 분당 최대 10회
- GET 요청: 분당 최대 30회

---

## Error Handling Patterns

### API Error Response Format
```typescript
interface ApiErrorResponse {
  error: {
    code: string; // 에러 코드 (예: 'UNAUTHORIZED', 'FORBIDDEN')
    message: string; // 사용자 친화적 메시지
    details?: Record<string, string>; // 필드별 에러 메시지 (유효성 검사)
  };
}
```

### Frontend Error Handling
```typescript
// React Query error handler
const handleApiError = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      // 인증 만료 → 로그아웃 후 로그인 페이지로
      logout();
      router.push('/login');
    } else if (error.status === 403) {
      // 권한 없음 → 대시보드로 리다이렉트
      toast.error('접근 권한이 없습니다');
      router.push('/staff/dashboard');
    } else if (error.status === 404) {
      // 리소스 없음
      toast.error('요청하신 정보를 찾을 수 없습니다');
    } else {
      // 기타 에러
      toast.error(error.message || '오류가 발생했습니다');
    }
  } else {
    // 네트워크 오류 등
    toast.error('네트워크 연결을 확인해주세요');
  }
};
```

---

## Performance Optimization

### React Query Configuration
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1분
      cacheTime: 5 * 60 * 1000, // 5분
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
```

### Polling Strategy
```typescript
// Dashboard: 1분마다 refetch
const { data } = useMyPatients({
  refetchInterval: 60 * 1000,
});

// Patient Detail: 수동 refetch만 (폴링 없음)
const { data, refetch } = usePatientDetail(patientId);
```

### Lazy Loading
- 히스토리 섹션: 펼칠 때 데이터 fetch
- 최근 전달사항: 별도 쿼리로 필요할 때만 fetch

---

## Testing Considerations

### Unit Tests
- 컴포넌트 렌더링 테스트
- 폼 유효성 검사 테스트
- 상태 변경 테스트

### Integration Tests
- API 호출 테스트 (MSW 사용)
- 페이지 간 이동 테스트
- 에러 처리 테스트

### E2E Tests (Playwright)
- 로그인 → 대시보드 → 환자 상세 → 전달사항 작성 플로우
- 지시사항 처리 완료 플로우
- 에러 시나리오 (네트워크 오류, 권한 없음 등)

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

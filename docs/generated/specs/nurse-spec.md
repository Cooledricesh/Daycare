# Nurse (간호사) Technical Specification

## Overview

간호사 페이지의 기술적 요구사항, API 계약, 컴포넌트 타입 정의, 유효성 검사 규칙을 정의합니다.

---

## API Endpoints

### 1. GET `/api/nurse/prescriptions`

**Purpose**: 오늘 처방 변경 건 목록 조회

**Authentication**: Required (role='nurse')

**Query Parameters**:
```typescript
interface PrescriptionsQuery {
  date?: string; // YYYY-MM-DD, 기본값: 오늘
  filter?: 'all' | 'pending' | 'completed'; // 기본값: 'all'
}
```

**Request**:
```http
GET /api/nurse/prescriptions?date=2025-01-29&filter=pending
Authorization: Bearer {JWT_TOKEN}
```

**Response** (200 OK):
```typescript
interface PrescriptionsResponse {
  prescriptions: Array<{
    id: string; // consultation.id
    patient: {
      id: string;
      name: string;
      birth_date: string | null;
      gender: 'M' | 'F' | null;
      coordinator_name: string | null;
    };
    consultation: {
      date: string;
      doctor_name: string;
      task_content: string;
      created_at: string; // ISO 8601
    };
    task: {
      id: string; // task_completion.id
      is_completed: boolean;
      completed_at: string | null;
      completed_by_name: string | null;
    };
  }>;
  summary: {
    total: number;
    pending: number;
    completed: number;
  };
}
```

**Error Codes**:
- `401 Unauthorized`: 인증 토큰 없음 또는 만료
- `403 Forbidden`: 역할이 'nurse'가 아님
- `500 Internal Server Error`: 서버 오류

**SQL Query** (참고):
```sql
SELECT
  c.*,
  p.name AS patient_name,
  p.birth_date,
  p.gender,
  s.name AS coordinator_name,
  d.name AS doctor_name,
  tc.id AS task_id,
  tc.is_completed,
  tc.completed_at,
  staff2.name AS completed_by_name
FROM consultations c
JOIN patients p ON p.id = c.patient_id
LEFT JOIN staff s ON s.id = p.coordinator_id
JOIN staff d ON d.id = c.doctor_id
LEFT JOIN task_completions tc ON tc.consultation_id = c.id AND tc.role = 'nurse'
LEFT JOIN staff staff2 ON staff2.id = tc.completed_by
WHERE c.date = :date
  AND c.has_task = true
  AND c.task_target IN ('nurse', 'both')
  AND (:filter = 'all' OR
       (:filter = 'pending' AND tc.is_completed = false) OR
       (:filter = 'completed' AND tc.is_completed = true))
ORDER BY c.created_at DESC;
```

---

### 2. POST `/api/nurse/task/:taskId/complete`

**Purpose**: 처방 변경 건 처리 완료 체크

**Authentication**: Required (role='nurse')

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
POST /api/nurse/task/{task_id}/complete
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "memo": "처방 변경 완료"
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
- `403 Forbidden`: role='nurse'가 아님
- `404 Not Found`: task를 찾을 수 없음
- `500 Internal Server Error`: 서버 오류

**Business Logic**:
```typescript
// task_completions 업데이트
UPDATE task_completions
SET
  is_completed = true,
  completed_at = NOW(),
  memo = :memo,
  completed_by = :currentUserId
WHERE id = :taskId
  AND role = 'nurse';
```

---

### 3. GET `/api/nurse/patients`

**Purpose**: 전체 활성 환자 목록 조회 (전달사항 작성용)

**Authentication**: Required (role='nurse')

**Request**:
```http
GET /api/nurse/patients
Authorization: Bearer {JWT_TOKEN}
```

**Response** (200 OK):
```typescript
interface PatientsResponse {
  patients: Array<{
    id: string;
    name: string;
    coordinator_name: string | null;
  }>;
}
```

**Error Codes**:
- `401 Unauthorized`: 인증 토큰 없음 또는 만료
- `403 Forbidden`: 역할이 'nurse'가 아님
- `500 Internal Server Error`: 서버 오류

**SQL Query** (참고):
```sql
SELECT
  p.id,
  p.name,
  s.name AS coordinator_name
FROM patients p
LEFT JOIN staff s ON s.id = p.coordinator_id
WHERE p.status = 'active'
ORDER BY p.name;
```

---

### 4. POST `/api/nurse/messages`

**Purpose**: 의사에게 전달사항 작성

**Authentication**: Required (role='nurse')

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
POST /api/nurse/messages
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "patient_id": "uuid-here",
  "content": "혈압약 처방 변경 완료했습니다.",
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
- `403 Forbidden`: 역할이 'nurse'가 아님
- `404 Not Found`: 환자를 찾을 수 없음
- `500 Internal Server Error`: 서버 오류

**Validation Rules**:
- `patient_id`: 필수, UUID 형식
- `content`: 필수, 1자 이상 2000자 이하
- `date`: 선택, YYYY-MM-DD 형식

**Business Logic**:
```sql
INSERT INTO messages (patient_id, date, author_id, author_role, content)
VALUES (:patient_id, :date, :current_user_id, 'nurse', :content);
```

---

## Components

### NurseLayout

**Purpose**: 간호사 페이지 공통 레이아웃

**Props**:
```typescript
interface NurseLayoutProps {
  children: React.ReactNode;
  title?: string; // 페이지 제목 (선택)
}
```

**Behavior**:
- 인증 확인 (role='nurse')
- 미인증 시 `/login`으로 리다이렉트
- 역할 불일치 시 역할별 첫 페이지로 리다이렉트
- Header, MobileNav 포함
- 모바일에서 햄버거 메뉴 표시

---

### PrescriptionsPage

**Purpose**: 처방 변경 목록 페이지

**State**:
```typescript
interface PrescriptionsPageState {
  filter: 'all' | 'pending' | 'completed'; // 필터 상태
  isMessageModalOpen: boolean; // 전달사항 모달 열림/닫힘
  isLoading: boolean;
  error: Error | null;
}
```

**Behavior**:
- 마운트 시 `usePrescriptions` 훅으로 데이터 fetch
- 1분마다 자동 refetch (폴링)
- 필터 변경 시 URL 쿼리 업데이트 (`?filter=pending`)
- 플로팅 버튼 클릭 시 전달사항 모달 열림
- 에러 시 재시도 버튼 표시

---

### FilterTabs

**Purpose**: 필터 탭 (전체/미처리/완료)

**Props**:
```typescript
interface FilterTabsProps {
  activeFilter: 'all' | 'pending' | 'completed';
  summary: {
    total: number;
    pending: number;
    completed: number;
  };
  onFilterChange: (filter: 'all' | 'pending' | 'completed') => void;
}
```

**Behavior**:
- 각 탭에 개수 표시 (예: "미처리 (5)")
- 활성 탭 강조 (primary 색상)
- 탭 클릭 시 `onFilterChange` 콜백 호출

---

### PrescriptionCard

**Purpose**: 처방 변경 카드 (목록 아이템)

**Props**:
```typescript
interface PrescriptionCardProps {
  prescription: {
    id: string;
    patient: {
      id: string;
      name: string;
      birth_date: string | null;
      gender: 'M' | 'F' | null;
      coordinator_name: string | null;
    };
    consultation: {
      date: string;
      doctor_name: string;
      task_content: string;
      created_at: string;
    };
    task: {
      id: string;
      is_completed: boolean;
      completed_at: string | null;
      completed_by_name: string | null;
    };
  };
  onComplete: (taskId: string) => Promise<void>;
  onDetailClick?: (prescriptionId: string) => void; // 선택적
}
```

**Behavior**:
- 미완료인 경우: 체크박스 표시, 체크 시 `onComplete` 호출
- 완료된 경우: 완료 표시 및 완료 시각/담당자 표시
- "상세" 버튼 클릭 시 `onDetailClick` 호출 (선택적)

---

### PrescriptionDetailModal (선택적)

**Purpose**: 처방 변경 상세 정보 모달

**Props**:
```typescript
interface PrescriptionDetailModalProps {
  prescription: {
    id: string;
    patient: {
      id: string;
      name: string;
      birth_date: string | null;
      gender: 'M' | 'F' | null;
      coordinator_name: string | null;
    };
    consultation: {
      date: string;
      doctor_name: string;
      task_content: string;
      created_at: string;
    };
    task: {
      id: string;
      is_completed: boolean;
      completed_at: string | null;
      completed_by_name: string | null;
    };
  };
  isOpen: boolean;
  onClose: () => void;
  onComplete: (taskId: string) => Promise<void>;
}
```

**Behavior**:
- 모달 열림 시 환자 기본 정보, 진찰 정보, 지시 내용 표시
- 미완료인 경우 "처리 완료" 버튼 표시
- 완료된 경우 완료 정보 표시
- 닫기 버튼 클릭 시 `onClose` 호출

---

### MessageModal

**Purpose**: 전달사항 작성 모달

**Props**:
```typescript
interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { patient_id: string; content: string }) => Promise<void>;
}
```

**State**:
```typescript
interface MessageModalState {
  selectedPatientId: string;
  content: string;
  isSubmitting: boolean;
}
```

**Behavior**:
- react-hook-form + zod로 유효성 검사
- 환자 선택 드롭다운 (전체 활성 환자 목록)
- 전송 중 버튼 비활성화
- 전송 성공 시 모달 닫기 및 폼 초기화
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
1. **Role 검증**: 모든 `/api/nurse/*` 엔드포인트에서 `role='nurse'` 확인
2. **JWT 검증**: 만료된 토큰 거부, httpOnly 쿠키 사용

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
      // 권한 없음 → 역할별 첫 페이지로 리다이렉트
      toast.error('접근 권한이 없습니다');
      router.push('/nurse/prescriptions');
    } else if (error.status === 404) {
      // 리소스 없음
      toast.error('요청하신 정보를 찾을 수 없습니다');
    } else if (error.status === 400) {
      // 유효성 검사 실패
      toast.error(error.message || '입력값을 확인해주세요');
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
// Prescriptions: 1분마다 refetch
const { data } = usePrescriptions({
  filter,
  refetchInterval: 60 * 1000,
});

// Patients: 캐시만 사용 (자주 변경되지 않음)
const { data: patientsData } = usePatients({
  staleTime: 5 * 60 * 1000, // 5분
});
```

### Optimistic Update
처리 완료 체크 시 즉시 UI 업데이트:

```typescript
const useCompleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, memo }: { taskId: string; memo?: string }) =>
      apiClient.post(`/api/nurse/task/${taskId}/complete`, { memo }),
    onMutate: async ({ taskId, prescriptionId }) => {
      // 진행 중인 refetch 취소
      await queryClient.cancelQueries(['prescriptions']);

      // 이전 데이터 백업
      const previousData = queryClient.getQueryData(['prescriptions']);

      // Optimistic update
      queryClient.setQueryData(['prescriptions'], (old: any) => ({
        ...old,
        prescriptions: old.prescriptions.map((p: any) =>
          p.id === prescriptionId
            ? {
                ...p,
                task: {
                  ...p.task,
                  is_completed: true,
                  completed_at: new Date().toISOString(),
                },
              }
            : p
        ),
        summary: {
          ...old.summary,
          pending: old.summary.pending - 1,
          completed: old.summary.completed + 1,
        },
      }));

      return { previousData };
    },
    onError: (error, variables, context) => {
      // 에러 시 이전 데이터로 롤백
      queryClient.setQueryData(['prescriptions'], context?.previousData);
      toast.error('처리 완료에 실패했습니다');
    },
    onSettled: () => {
      // 서버 데이터로 동기화
      queryClient.invalidateQueries(['prescriptions']);
    },
  });
};
```

---

## Testing Considerations

### Unit Tests
- 컴포넌트 렌더링 테스트
- 필터 변경 테스트
- 폼 유효성 검사 테스트
- 체크박스 상태 변경 테스트

### Integration Tests
- API 호출 테스트 (MSW 사용)
- 처리 완료 플로우 테스트
- 전달사항 작성 플로우 테스트
- 에러 처리 테스트

### E2E Tests (Playwright)
- 로그인 → 처방 변경 목록 → 필터링 → 처리 완료 플로우
- 전달사항 작성 플로우
- 에러 시나리오 (네트워크 오류, 권한 없음 등)

---

## UI Component Specifications

### FilterTabs

**HTML Structure**:
```tsx
<div className="flex gap-2 mb-4">
  <button
    className={`px-4 py-2 rounded-lg ${
      activeFilter === 'all'
        ? 'bg-primary text-white'
        : 'bg-gray-100 text-gray-700'
    }`}
    onClick={() => onFilterChange('all')}
  >
    전체 ({summary.total})
  </button>
  <button
    className={`px-4 py-2 rounded-lg ${
      activeFilter === 'pending'
        ? 'bg-primary text-white'
        : 'bg-gray-100 text-gray-700'
    }`}
    onClick={() => onFilterChange('pending')}
  >
    미처리 ({summary.pending})
  </button>
  <button
    className={`px-4 py-2 rounded-lg ${
      activeFilter === 'completed'
        ? 'bg-primary text-white'
        : 'bg-gray-100 text-gray-700'
    }`}
    onClick={() => onFilterChange('completed')}
  >
    완료 ({summary.completed})
  </button>
</div>
```

### PrescriptionCard

**HTML Structure**:
```tsx
<div className="bg-white rounded-lg shadow p-4 mb-3">
  <div className="flex justify-between items-start mb-2">
    <div>
      <h3 className="font-semibold text-lg">{prescription.patient.name}</h3>
      {prescription.patient.coordinator_name && (
        <p className="text-sm text-gray-600">
          담당: {prescription.patient.coordinator_name}
        </p>
      )}
    </div>
    {!prescription.task.is_completed && (
      <Checkbox
        checked={false}
        onCheckedChange={() => onComplete(prescription.task.id)}
        aria-label="처리 완료"
      />
    )}
  </div>
  <p className="text-gray-800 mb-2">{prescription.consultation.task_content}</p>
  {prescription.task.is_completed && (
    <p className="text-sm text-green-600">
      ✓ {format(new Date(prescription.task.completed_at), 'HH:mm')} 처리 완료
      {prescription.task.completed_by_name && ` (${prescription.task.completed_by_name})`}
    </p>
  )}
  {onDetailClick && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onDetailClick(prescription.id)}
      className="mt-2"
    >
      상세
    </Button>
  )}
</div>
```

### Floating Button

**HTML Structure**:
```tsx
<button
  className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
  onClick={onOpenMessageModal}
  aria-label="전달사항 작성"
>
  <MessageSquare className="w-6 h-6" />
</button>
```

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

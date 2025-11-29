# Doctor Pages Technical Specification

## Overview

의사용 페이지의 기술적 구현 명세서입니다. API 계약, 컴포넌트 인터페이스, 유효성 검사 규칙을 정의합니다.

---

## API Endpoints

### 1. GET /api/doctor/patients/today

**목적**: 오늘 출석 예정 + 실제 출석 + 진찰 여부 조회

**Query Parameters**:
```typescript
interface GetTodayPatientsParams {
  date?: string; // ISO date (기본값: 오늘)
  status?: 'all' | 'pending' | 'completed'; // 필터
}
```

**Request Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response (200 OK)**:
```typescript
interface GetTodayPatientsResponse {
  patients: Array<{
    id: string;
    name: string;
    birth_date: string; // ISO date
    gender: 'M' | 'F';
    coordinator_name: string | null;
    is_attended: boolean;
    checked_at: string | null; // ISO datetime
    is_consulted: boolean;
    has_task: boolean;
    unread_message_count: number;
  }>;
  summary: {
    total: number;
    pending: number;
    completed: number;
  };
}
```

**Error Codes**:
- 400: 잘못된 요청 (날짜 형식 오류)
- 401: 인증 실패
- 403: 의사 권한 없음

**SQL Query**:
```sql
SELECT
  p.id,
  p.name,
  p.birth_date,
  p.gender,
  s.name AS coordinator_name,
  CASE WHEN a.id IS NOT NULL THEN true ELSE false END AS is_attended,
  a.checked_at,
  CASE WHEN c.id IS NOT NULL THEN true ELSE false END AS is_consulted,
  COALESCE(c.has_task, false) AS has_task,
  (SELECT COUNT(*) FROM messages m
   WHERE m.patient_id = p.id
   AND m.date = $1
   AND m.is_read = false) AS unread_message_count
FROM scheduled_attendances sa
JOIN patients p ON p.id = sa.patient_id
LEFT JOIN staff s ON s.id = p.coordinator_id
LEFT JOIN attendances a ON a.patient_id = p.id AND a.date = $1
LEFT JOIN consultations c ON c.patient_id = p.id AND c.date = $1
WHERE sa.date = $1
  AND sa.is_cancelled = false
  AND ($2 = 'all' OR
       ($2 = 'pending' AND c.id IS NULL) OR
       ($2 = 'completed' AND c.id IS NOT NULL))
ORDER BY p.name;
```

---

### 2. GET /api/doctor/patients/:id/messages

**목적**: 특정 환자의 오늘 전달사항 조회

**Path Parameters**:
```typescript
interface GetPatientMessagesParams {
  id: string; // patient_id
}
```

**Query Parameters**:
```typescript
interface GetPatientMessagesQuery {
  date?: string; // ISO date (기본값: 오늘)
}
```

**Response (200 OK)**:
```typescript
interface GetPatientMessagesResponse {
  messages: Array<{
    id: string;
    content: string;
    author_name: string;
    author_role: 'coordinator' | 'nurse';
    created_at: string; // ISO datetime
    is_read: boolean;
  }>;
}
```

**Error Codes**:
- 400: 잘못된 요청
- 401: 인증 실패
- 403: 의사 권한 없음
- 404: 환자 없음

**SQL Query**:
```sql
SELECT
  m.id,
  m.content,
  s.name AS author_name,
  m.author_role,
  m.created_at,
  m.is_read
FROM messages m
JOIN staff s ON s.id = m.author_id
WHERE m.patient_id = $1
  AND m.date = $2
ORDER BY m.created_at ASC;
```

---

### 3. PUT /api/doctor/messages/:id/read

**목적**: 전달사항 읽음 처리

**Path Parameters**:
```typescript
interface MarkMessageAsReadParams {
  id: string; // message_id
}
```

**Request Body**: 없음

**Response (200 OK)**:
```typescript
interface MarkMessageAsReadResponse {
  success: boolean;
  read_at: string; // ISO datetime
}
```

**Error Codes**:
- 401: 인증 실패
- 403: 의사 권한 없음
- 404: 메시지 없음

**SQL Query**:
```sql
UPDATE messages
SET is_read = true, read_at = NOW()
WHERE id = $1
RETURNING read_at;
```

---

### 4. GET /api/doctor/patients/:id/history

**목적**: 환자별 최근 진찰 기록 조회

**Path Parameters**:
```typescript
interface GetPatientHistoryParams {
  id: string; // patient_id
}
```

**Query Parameters**:
```typescript
interface GetPatientHistoryQuery {
  days?: number; // 조회 기간 (기본값: 30일)
}
```

**Response (200 OK)**:
```typescript
interface GetPatientHistoryResponse {
  history: Array<{
    id: string;
    date: string; // ISO date
    note: string | null;
    has_task: boolean;
    task_content: string | null;
    task_target: 'coordinator' | 'nurse' | 'both' | null;
    doctor_name: string;
  }>;
}
```

**Error Codes**:
- 400: 잘못된 요청
- 401: 인증 실패
- 403: 의사 권한 없음
- 404: 환자 없음

**SQL Query**:
```sql
SELECT
  c.id,
  c.date,
  c.note,
  c.has_task,
  c.task_content,
  c.task_target,
  d.name AS doctor_name
FROM consultations c
JOIN staff d ON d.id = c.doctor_id
WHERE c.patient_id = $1
  AND c.date >= CURRENT_DATE - INTERVAL '$2 days'
ORDER BY c.date DESC;
```

---

### 5. POST /api/doctor/consultations

**목적**: 진찰 기록 저장 + 처리 필요 항목 생성

**Request Body**:
```typescript
interface CreateConsultationRequest {
  patient_id: string;
  date: string; // ISO date
  note: string;
  has_task: boolean;
  task_content?: string;
  task_target?: 'coordinator' | 'nurse' | 'both';
}
```

**Validation (Zod)**:
```typescript
const createConsultationSchema = z.object({
  patient_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().min(1, '면담 내용을 입력해주세요'),
  has_task: z.boolean(),
  task_content: z.string().optional(),
  task_target: z.enum(['coordinator', 'nurse', 'both']).optional(),
}).refine((data) => {
  if (data.has_task) {
    return data.task_content && data.task_content.trim().length > 0 && data.task_target;
  }
  return true;
}, {
  message: '처리 필요 항목 체크 시 지시 내용과 대상을 입력해주세요',
  path: ['task_content'],
});
```

**Response (201 Created)**:
```typescript
interface CreateConsultationResponse {
  consultation_id: string;
  task_completions?: Array<{
    id: string;
    role: 'coordinator' | 'nurse';
  }>;
}
```

**Error Codes**:
- 400: 유효성 검사 실패
- 401: 인증 실패
- 403: 의사 권한 없음
- 404: 환자 없음
- 409: 이미 진찰한 환자 (patient_id, date 중복)

**SQL Transaction**:
```sql
BEGIN;

-- 1. consultations 삽입
INSERT INTO consultations (patient_id, date, doctor_id, note, has_task, task_content, task_target)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id;

-- 2. has_task = true인 경우 task_completions 생성
-- task_target = 'coordinator'
INSERT INTO task_completions (consultation_id, completed_by, role, is_completed)
VALUES ($consultation_id, $coordinator_id, 'coordinator', false);

-- task_target = 'nurse'
INSERT INTO task_completions (consultation_id, completed_by, role, is_completed)
VALUES ($consultation_id, $nurse_id, 'nurse', false);

-- task_target = 'both'
INSERT INTO task_completions (consultation_id, completed_by, role, is_completed)
VALUES
  ($consultation_id, $coordinator_id, 'coordinator', false),
  ($consultation_id, $nurse_id, 'nurse', false);

COMMIT;
```

**비즈니스 로직**:
1. 진찰 기록 저장 (consultations)
2. has_task = true인 경우:
   - task_target에 따라 task_completions row 생성
   - 'both'인 경우 coordinator, nurse 각각 1개씩 총 2개 생성
   - completed_by는 해당 환자의 담당 코디/담당 간호사 (기본값 또는 선택)

---

### 6. GET /api/doctor/tasks

**목적**: 오늘 처리 필요 항목 조회

**Query Parameters**:
```typescript
interface GetDoctorTasksQuery {
  date?: string; // ISO date (기본값: 오늘)
  status?: 'all' | 'pending' | 'completed'; // 필터
}
```

**Response (200 OK)**:
```typescript
interface GetDoctorTasksResponse {
  tasks: Array<{
    consultation_id: string;
    patient_id: string;
    patient_name: string;
    task_content: string;
    task_target: 'coordinator' | 'nurse' | 'both';
    coordinator_completed: boolean | null;
    nurse_completed: boolean | null;
    created_at: string; // ISO datetime
  }>;
}
```

**Error Codes**:
- 400: 잘못된 요청
- 401: 인증 실패
- 403: 의사 권한 없음

**SQL Query**:
```sql
SELECT
  c.id AS consultation_id,
  c.patient_id,
  p.name AS patient_name,
  c.task_content,
  c.task_target,
  (SELECT is_completed FROM task_completions tc
   WHERE tc.consultation_id = c.id AND tc.role = 'coordinator') AS coordinator_completed,
  (SELECT is_completed FROM task_completions tc
   WHERE tc.consultation_id = c.id AND tc.role = 'nurse') AS nurse_completed,
  c.created_at
FROM consultations c
JOIN patients p ON p.id = c.patient_id
WHERE c.date = $1
  AND c.has_task = true
  AND ($2 = 'all' OR
       ($2 = 'pending' AND EXISTS (
         SELECT 1 FROM task_completions tc
         WHERE tc.consultation_id = c.id AND tc.is_completed = false
       )) OR
       ($2 = 'completed' AND NOT EXISTS (
         SELECT 1 FROM task_completions tc
         WHERE tc.consultation_id = c.id AND tc.is_completed = false
       )))
ORDER BY c.created_at ASC;
```

---

## Components

### 1. DoctorConsultationPage

**Props**:
```typescript
// 페이지 컴포넌트 - props 없음
```

**State**:
```typescript
interface ConsultationPageState {
  selectedPatientId: string | null;
  searchQuery: string;
  searchFocused: boolean;
}
```

**Behavior**:
- 오늘 출석 환자 목록 조회 (React Query)
- 환자 선택 시 우측 패널에 상세 정보 표시
- 검색어 입력 시 환자 목록 필터링 (초성 검색 포함)
- 키보드 단축키 (Ctrl+K, /, Esc)

---

### 2. PatientListPanel

**Props**:
```typescript
interface PatientListPanelProps {
  patients: Array<{
    id: string;
    name: string;
    birth_date: string;
    gender: 'M' | 'F';
    coordinator_name: string | null;
    is_attended: boolean;
    is_consulted: boolean;
    has_task: boolean;
    unread_message_count: number;
  }>;
  selectedPatientId: string | null;
  onSelectPatient: (id: string) => void;
  searchQuery: string;
}
```

**State**: 없음 (Stateless)

**Behavior**:
- 환자 목록 표시
- 선택된 환자 하이라이트
- 상태 아이콘 표시 (⏳/✓/💬/🔔)
- 요약 표시 (대기: N명, 완료: N명)

---

### 3. ConsultationForm

**Props**:
```typescript
interface ConsultationFormProps {
  patient: {
    id: string;
    name: string;
    birth_date: string;
    gender: 'M' | 'F';
    coordinator_name: string | null;
  };
  onSubmit: (data: CreateConsultationRequest) => Promise<void>;
}
```

**State**:
```typescript
interface ConsultationFormState {
  note: string;
  has_task: boolean;
  task_target: 'coordinator' | 'nurse' | 'both';
  task_content: string;
  isSubmitting: boolean;
}
```

**Behavior**:
- 면담 내용 입력
- 처리 필요 항목 체크 시 확장 영역 표시
- 폼 유효성 검사 (Zod)
- Enter 키로 제출
- 제출 후 폼 초기화 및 다음 환자로 이동

---

### 4. MessagesSection

**Props**:
```typescript
interface MessagesSectionProps {
  patientId: string;
  date: string;
}
```

**State**: 없음 (React Query)

**Behavior**:
- 전달사항 조회 (React Query)
- 메시지 표시
- 메시지 읽음 처리 (자동)

---

### 5. RecentHistorySection

**Props**:
```typescript
interface RecentHistorySectionProps {
  patientId: string;
  days?: number; // 기본값: 30
}
```

**State**:
```typescript
interface RecentHistorySectionState {
  isExpanded: boolean;
}
```

**Behavior**:
- 최근 기록 조회 (React Query)
- 접기/펼치기 토글
- 날짜별 기록 표시

---

### 6. DoctorTasksPage

**Props**: 없음

**State**:
```typescript
interface TasksPageState {
  statusFilter: 'all' | 'pending' | 'completed';
}
```

**Behavior**:
- 처리 필요 목록 조회 (React Query)
- 필터링 (전체/미처리/완료)
- 테이블 표시

---

## Validation Rules

### 진찰 기록 저장 (CreateConsultationRequest)

```typescript
const createConsultationSchema = z.object({
  patient_id: z.string().uuid('올바른 환자 ID가 아닙니다'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  note: z.string().min(1, '면담 내용을 입력해주세요'),
  has_task: z.boolean(),
  task_content: z.string().optional(),
  task_target: z.enum(['coordinator', 'nurse', 'both']).optional(),
}).refine((data) => {
  if (data.has_task) {
    return data.task_content && data.task_content.trim().length > 0 && data.task_target;
  }
  return true;
}, {
  message: '처리 필요 항목 체크 시 지시 내용과 대상을 입력해주세요',
  path: ['task_content'],
});
```

**에러 메시지**:
- `patient_id`: "올바른 환자 ID가 아닙니다"
- `date`: "올바른 날짜 형식이 아닙니다"
- `note`: "면담 내용을 입력해주세요"
- `task_content`: "처리 필요 항목 체크 시 지시 내용과 대상을 입력해주세요"

---

## Utility Functions

### 1. 초성 검색

```typescript
/**
 * 한글 이름이 주어진 초성 패턴과 일치하는지 확인
 * @param name - 환자 이름 (예: "홍길동")
 * @param query - 검색어 (예: "ㅎㄱㄷ" 또는 "홍길")
 * @returns 일치 여부
 */
function matchesChosung(name: string, query: string): boolean {
  const CHOSUNG_LIST = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
    'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];

  const getChosung = (char: string): string => {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return char; // 한글이 아닌 경우
    return CHOSUNG_LIST[Math.floor(code / 588)];
  };

  const nameChosung = Array.from(name).map(getChosung).join('');

  // 초성 매칭
  if (nameChosung.includes(query)) return true;

  // 일반 문자열 매칭
  if (name.includes(query)) return true;

  return false;
}
```

### 2. 나이 계산

```typescript
import { differenceInYears, parseISO } from 'date-fns';

/**
 * 생년월일로부터 현재 나이 계산
 * @param birthDate - ISO 형식 생년월일 (예: "1990-01-01")
 * @returns 만 나이
 */
function calculateAge(birthDate: string): number {
  return differenceInYears(new Date(), parseISO(birthDate));
}
```

### 3. 키보드 단축키 훅

```typescript
import { useEffect } from 'react';

/**
 * 키보드 단축키 등록
 * @param shortcuts - 키 조합과 핸들러 맵
 * @param dependencies - 의존성 배열
 */
function useKeyboardShortcuts(
  shortcuts: Record<string, (event: KeyboardEvent) => void>,
  dependencies: any[] = []
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = [
        event.ctrlKey && 'Ctrl',
        event.shiftKey && 'Shift',
        event.altKey && 'Alt',
        event.metaKey && 'Meta',
        event.key
      ]
        .filter(Boolean)
        .join('+');

      const handler = shortcuts[key];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, dependencies);
}

// 사용 예시
useKeyboardShortcuts({
  'Ctrl+k': () => setSearchFocused(true),
  '/': () => setSearchFocused(true),
  'Enter': () => handleSubmit(),
  'Ctrl+t': () => setHasTask(!hasTask),
  'Escape': () => setSearchFocused(false),
}, [hasTask]);
```

---

## Security Considerations

### 1. 인증 및 권한

- **JWT 토큰 검증**: 모든 API 요청에서 토큰 확인
- **역할 확인**: role='doctor'만 접근 허용
- **환자 정보 보호**: 민감한 정보는 의사에게만 노출

### 2. 입력 검증

- **클라이언트 측**: Zod 스키마로 즉시 검증
- **서버 측**: 동일한 Zod 스키마로 재검증
- **SQL Injection 방지**: Parameterized Query 사용

### 3. 데이터 접근 제한

- **읽기**: 의사는 모든 환자의 진찰 기록 조회 가능
- **쓰기**: 자신이 작성한 진찰 기록만 수정 가능 (향후 구현)

---

## Error Handling Patterns

### 1. API 에러 처리

```typescript
// Hono 에러 응답 형식
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// 클라이언트 에러 처리
try {
  const response = await fetch('/api/doctor/consultations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error.message);
  }

  const result = await response.json();
  return result;
} catch (error) {
  if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error('알 수 없는 오류가 발생했습니다');
  }
}
```

### 2. React Query 에러 처리

```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['doctor', 'patients', 'today', date],
  queryFn: () => fetchTodayPatients(date),
  retry: 3,
  retryDelay: 1000,
  onError: (error) => {
    toast.error('환자 목록을 불러올 수 없습니다');
  },
});

if (error) {
  return <ErrorFallback error={error} retry={refetch} />;
}
```

---

## Performance Optimization

### 1. React Query 캐싱

```typescript
// 5분간 캐싱
const { data } = useQuery({
  queryKey: ['doctor', 'patients', 'today', date],
  queryFn: () => fetchTodayPatients(date),
  staleTime: 5 * 60 * 1000, // 5분
  cacheTime: 10 * 60 * 1000, // 10분
});
```

### 2. 낙관적 업데이트

```typescript
const mutation = useMutation({
  mutationFn: createConsultation,
  onMutate: async (newConsultation) => {
    // 기존 쿼리 취소
    await queryClient.cancelQueries(['doctor', 'patients', 'today']);

    // 이전 데이터 스냅샷
    const previousData = queryClient.getQueryData(['doctor', 'patients', 'today']);

    // 낙관적 업데이트
    queryClient.setQueryData(['doctor', 'patients', 'today'], (old: any) => {
      return {
        ...old,
        patients: old.patients.map((p: any) =>
          p.id === newConsultation.patient_id
            ? { ...p, is_consulted: true }
            : p
        ),
      };
    });

    return { previousData };
  },
  onError: (err, newConsultation, context) => {
    // 롤백
    queryClient.setQueryData(['doctor', 'patients', 'today'], context?.previousData);
    toast.error('진찰 기록 저장에 실패했습니다');
  },
  onSuccess: () => {
    toast.success('진찰 기록이 저장되었습니다');
  },
});
```

### 3. 폴링

```typescript
// 5분마다 자동 갱신
const { data } = useQuery({
  queryKey: ['doctor', 'patients', 'today', date],
  queryFn: () => fetchTodayPatients(date),
  refetchInterval: 5 * 60 * 1000, // 5분
  refetchIntervalInBackground: false,
});
```

---

## Testing

### Unit Tests

```typescript
describe('matchesChosung', () => {
  it('should match chosung pattern', () => {
    expect(matchesChosung('홍길동', 'ㅎㄱㄷ')).toBe(true);
    expect(matchesChosung('홍길동', 'ㄱㄱㄷ')).toBe(false);
  });

  it('should match partial name', () => {
    expect(matchesChosung('홍길동', '홍길')).toBe(true);
    expect(matchesChosung('홍길동', '길동')).toBe(true);
  });
});

describe('calculateAge', () => {
  it('should calculate correct age', () => {
    const birthDate = '1990-01-01';
    const age = calculateAge(birthDate);
    expect(age).toBeGreaterThanOrEqual(34);
  });
});
```

### Integration Tests

```typescript
describe('POST /api/doctor/consultations', () => {
  it('should create consultation successfully', async () => {
    const response = await request(app)
      .post('/api/doctor/consultations')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patient_id: 'patient-uuid',
        date: '2025-01-29',
        note: '상태 양호',
        has_task: true,
        task_content: '약 변경',
        task_target: 'nurse',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('consultation_id');
    expect(response.body.task_completions).toHaveLength(1);
  });

  it('should fail with invalid data', async () => {
    const response = await request(app)
      .post('/api/doctor/consultations')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patient_id: 'invalid-uuid',
        date: '2025-01-29',
        note: '',
        has_task: false,
      });

    expect(response.status).toBe(400);
  });
});
```

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

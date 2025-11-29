# Patient Page Technical Specification

## Overview

환자용 출석 체크 페이지의 기술 명세서. API 엔드포인트, 컴포넌트 인터페이스, 검증 규칙, 보안 고려사항을 정의합니다.

## API Endpoints

### GET /api/patients/search

**Purpose**: 환자 이름 검색 (자동완성용)

**Query Parameters**:
```typescript
interface SearchQueryParams {
  q: string; // 검색어 (최소 1자)
}
```

**Response** (200 OK):
```typescript
interface SearchPatientsResponse {
  success: true;
  data: Array<{
    id: string;
    name: string;
  }>;
}
```

**Error Codes**:
- `400`: Bad Request - 검색어 누락
- `500`: Internal Server Error

**SQL Query**:
```sql
SELECT id, name
FROM patients
WHERE status = 'active'
  AND name LIKE :query || '%'
ORDER BY name
LIMIT 10;
```

---

### POST /api/attendances

**Purpose**: 출석 기록 저장

**Request Body**:
```typescript
interface CreateAttendanceRequest {
  patient_id: string;
  date: string; // ISO 8601 format (YYYY-MM-DD)
}
```

**Response** (201 Created):
```typescript
interface CreateAttendanceResponse {
  success: true;
  data: {
    id: string;
    patient_id: string;
    date: string;
    checked_at: string; // ISO 8601 timestamp
  };
}
```

**Error Codes**:
- `400`: Bad Request - 잘못된 요청 (필수 필드 누락, 유효하지 않은 날짜)
- `409`: Conflict - 이미 출석한 환자 (UNIQUE 제약 위반)
- `500`: Internal Server Error

**SQL**:
```sql
INSERT INTO attendances (patient_id, date, checked_at)
VALUES (:patient_id, :date, NOW())
ON CONFLICT (patient_id, date) DO NOTHING
RETURNING *;
```

---

### GET /api/attendances/check

**Purpose**: 출석 여부 확인

**Query Parameters**:
```typescript
interface CheckAttendanceQueryParams {
  patient_id: string;
  date: string; // ISO 8601 format (YYYY-MM-DD)
}
```

**Response** (200 OK):
```typescript
interface CheckAttendanceResponse {
  success: true;
  data: {
    is_attended: boolean;
  };
}
```

**Error Codes**:
- `400`: Bad Request
- `500`: Internal Server Error

**SQL**:
```sql
SELECT EXISTS(
  SELECT 1 FROM attendances
  WHERE patient_id = :patient_id AND date = :date
) AS is_attended;
```

---

### POST /api/vitals

**Purpose**: 활력징후 기록 저장

**Request Body**:
```typescript
interface CreateVitalsRequest {
  patient_id: string;
  date: string; // ISO 8601 format (YYYY-MM-DD)
  systolic?: number | null; // 수축기 혈압 (선택)
  diastolic?: number | null; // 이완기 혈압 (선택)
  blood_sugar?: number | null; // 혈당 (선택)
  memo?: string | null; // 메모 (선택)
}
```

**Response** (201 Created):
```typescript
interface CreateVitalsResponse {
  success: true;
  data: {
    id: string;
    patient_id: string;
    date: string;
    systolic: number | null;
    diastolic: number | null;
    blood_sugar: number | null;
    memo: string | null;
    recorded_at: string; // ISO 8601 timestamp
  };
}
```

**Error Codes**:
- `400`: Bad Request
- `409`: Conflict - 이미 등록된 활력징후 (UNIQUE 제약)
- `500`: Internal Server Error

**SQL**:
```sql
INSERT INTO vitals (patient_id, date, systolic, diastolic, blood_sugar, memo, recorded_at)
VALUES (:patient_id, :date, :systolic, :diastolic, :blood_sugar, :memo, NOW())
ON CONFLICT (patient_id, date) DO UPDATE SET
  systolic = EXCLUDED.systolic,
  diastolic = EXCLUDED.diastolic,
  blood_sugar = EXCLUDED.blood_sugar,
  memo = EXCLUDED.memo,
  recorded_at = NOW()
RETURNING *;
```

---

## Components

### PatientCheckInPage

**Props**: None (페이지 컴포넌트)

**State**:
```typescript
interface PatientCheckInPageState {
  step: 'search' | 'confirm' | 'vitals' | 'complete';
  selectedPatient: { id: string; name: string } | null;
  searchQuery: string;
  vitalsInput: {
    systolic: string;
    diastolic: string;
    blood_sugar: string;
  };
}
```

**Behavior**:
- 초기 상태: `step = 'search'`
- 환자 선택 시: `step = 'confirm'`으로 전환
- 출석 저장 성공 시: `step = 'vitals'`로 전환
- 활력징후 저장 또는 건너뛰기 시: `step = 'complete'`로 전환
- 완료 화면에서 5초 후 자동으로 `step = 'search'`로 리셋

---

### PatientSearchSection

**Props**:
```typescript
interface PatientSearchSectionProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onPatientSelect: (patient: { id: string; name: string }) => void;
}
```

**State**:
```typescript
interface PatientSearchSectionState {
  // React Query로 관리
  patients: Array<{ id: string; name: string }>;
  isLoading: boolean;
  error: Error | null;
}
```

**Behavior**:
- 검색어 입력 시 debounce 적용 (300ms)
- 검색어 1자 이상일 때만 API 호출
- 검색 결과를 자동완성 목록으로 표시
- 환자 클릭 시 `onPatientSelect` 호출

---

### ConfirmationModal

**Props**:
```typescript
interface ConfirmationModalProps {
  patient: { id: string; name: string };
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}
```

**State**: None (제어 컴포넌트)

**Behavior**:
- "아니오" 버튼 클릭 시 `onCancel` 호출
- "예" 버튼 클릭 시 `onConfirm` 호출

---

### VitalsInputSection

**Props**:
```typescript
interface VitalsInputSectionProps {
  patientName: string;
  vitalsInput: {
    systolic: string;
    diastolic: string;
    blood_sugar: string;
  };
  onVitalsInputChange: (field: 'systolic' | 'diastolic' | 'blood_sugar', value: string) => void;
  onSkip: () => void;
  onSave: () => void;
  isSaving: boolean;
}
```

**State**: None (제어 컴포넌트)

**Behavior**:
- 숫자만 입력 가능 (input type="number")
- "건너뛰기" 버튼 클릭 시 `onSkip` 호출
- "저장" 버튼 클릭 시 `onSave` 호출
- 저장 중일 때 버튼 비활성화

---

### CompletionScreen

**Props**:
```typescript
interface CompletionScreenProps {
  patientName: string;
  onReset: () => void;
}
```

**State**:
```typescript
interface CompletionScreenState {
  countdown: number; // 5초 카운트다운
}
```

**Behavior**:
- 마운트 시 5초 타이머 시작
- 매 초마다 countdown 감소
- countdown이 0이 되면 `onReset` 호출
- "처음으로" 버튼 클릭 시 즉시 `onReset` 호출
- 언마운트 시 타이머 정리

---

## Validation Rules

### 검색어 검증

```typescript
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().min(1, '검색어를 입력해주세요'),
});
```

### 출석 기록 검증

```typescript
const createAttendanceSchema = z.object({
  patient_id: z.string().uuid('유효하지 않은 환자 ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '유효하지 않은 날짜 형식'),
});
```

### 활력징후 검증

```typescript
const createVitalsSchema = z.object({
  patient_id: z.string().uuid('유효하지 않은 환자 ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '유효하지 않은 날짜 형식'),
  systolic: z.number().int().min(50).max(250).nullable().optional(),
  diastolic: z.number().int().min(30).max(150).nullable().optional(),
  blood_sugar: z.number().int().min(30).max(600).nullable().optional(),
  memo: z.string().max(500).nullable().optional(),
});

// 클라이언트 측 입력값 변환
function parseVitalsInput(input: {
  systolic: string;
  diastolic: string;
  blood_sugar: string;
}): {
  systolic: number | null;
  diastolic: number | null;
  blood_sugar: number | null;
} {
  return {
    systolic: input.systolic ? parseInt(input.systolic, 10) : null,
    diastolic: input.diastolic ? parseInt(input.diastolic, 10) : null,
    blood_sugar: input.blood_sugar ? parseInt(input.blood_sugar, 10) : null,
  };
}
```

---

## React Query Hooks

### useSearchPatients

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';

function useSearchPatients(query: string) {
  return useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: async () => {
      const response = await apiClient.get('/api/patients/search', {
        params: { q: query },
      });
      return response.data.data;
    },
    enabled: query.length > 0,
    staleTime: 5 * 60 * 1000, // 5분
  });
}
```

### useCreateAttendance

```typescript
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';

function useCreateAttendance() {
  return useMutation({
    mutationFn: async (data: CreateAttendanceRequest) => {
      const response = await apiClient.post('/api/attendances', data);
      return response.data.data;
    },
  });
}
```

### useCheckAttendance

```typescript
function useCheckAttendance(patientId: string, date: string) {
  return useQuery({
    queryKey: ['attendances', 'check', patientId, date],
    queryFn: async () => {
      const response = await apiClient.get('/api/attendances/check', {
        params: { patient_id: patientId, date },
      });
      return response.data.data.is_attended;
    },
    enabled: !!patientId && !!date,
  });
}
```

### useCreateVitals

```typescript
function useCreateVitals() {
  return useMutation({
    mutationFn: async (data: CreateVitalsRequest) => {
      const response = await apiClient.post('/api/vitals', data);
      return response.data.data;
    },
  });
}
```

---

## Error Handling Pattern

```typescript
// API 오류 처리
function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 409) {
      return '이미 출석하셨습니다';
    }
    if (error.response?.status === 400) {
      return '입력값을 확인해주세요';
    }
    if (error.response?.status >= 500) {
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요';
    }
  }
  return '네트워크 연결을 확인해주세요';
}

// 컴포넌트에서 사용
const createAttendance = useCreateAttendance();

const handleConfirm = async () => {
  try {
    await createAttendance.mutateAsync({
      patient_id: selectedPatient.id,
      date: format(new Date(), 'yyyy-MM-dd'),
    });
    setStep('vitals');
  } catch (error) {
    const errorMessage = handleApiError(error);
    toast.error(errorMessage);
  }
};
```

---

## Security Considerations

### 1. 입력값 검증

- 클라이언트와 서버 모두에서 zod 스키마로 검증
- SQL Injection 방지: Prepared Statements 사용
- XSS 방지: React의 자동 이스케이프 활용

### 2. 접근 제한

- 환자 페이지는 인증 불필요하지만, 필요 시 IP 화이트리스트 적용
- 환자 검색은 활성 환자(status='active')만 조회

### 3. 데이터 보호

- 민감한 환자 정보(생년월일, 진단명 등)는 검색 결과에 포함하지 않음
- 출석 기록만 저장 (최소한의 정보)

### 4. Rate Limiting (향후 고려)

- 동일 IP에서 과도한 출석 체크 시도 방지
- API 호출 빈도 제한

---

## Performance Optimization

### 1. Debounce 검색

```typescript
import { debounce } from 'es-toolkit';

const debouncedSearch = debounce((query: string) => {
  setSearchQuery(query);
}, 300);
```

### 2. React Query 캐싱

- 검색 결과: 5분 캐시
- 출석 여부: 캐시 비활성화 (실시간 확인)

### 3. 최적화된 SQL 인덱스

- `patients(name)`: 검색 성능 향상
- `attendances(patient_id, date)`: UNIQUE 제약 + 조회 성능

---

## Accessibility

- `aria-label` 속성으로 스크린 리더 지원
- 키보드 네비게이션 (Tab, Enter)
- 충분한 색상 대비 (WCAG AA 기준)
- 큰 터치 영역 (최소 50px)

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

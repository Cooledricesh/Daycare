# Doctor Pages Implementation Plan

## Overview

의사용 페이지는 빠른 진찰 흐름을 지원하기 위해 키보드 중심 UX와 효율적인 데이터 입력 방식을 제공합니다.

### PRD 참조 섹션
- 7.3 의사용 화면 (데스크탑)
- 3. 의사 진찰 Flow
- 8. 키보드 단축키

### 주요 목표
- 환자당 10초~180초 진찰 속도 지원
- 키보드 중심 UX (마우스 최소 사용)
- 실시간 환자 상태 확인
- 효율적인 처리 필요 항목 관리

---

## Component Hierarchy

### 1. /doctor/consultation (진찰 메인)

```
DoctorConsultationPage
├── DoctorLayout
│   ├── TopNavigation
│   │   ├── Logo
│   │   ├── TabMenu ([진찰], [처리필요], [설정])
│   │   └── UserMenu (의사명, 로그아웃)
│   └── MainContent
│       ├── SearchBar (Ctrl+K 단축키)
│       ├── SplitView
│       │   ├── PatientListPanel (왼쪽)
│       │   │   ├── ListHeader (오늘 출석 N명)
│       │   │   ├── PatientListItem[]
│       │   │   │   ├── StatusIcon (⏳/✓)
│       │   │   │   ├── PatientName
│       │   │   │   ├── MessageBadge (💬)
│       │   │   │   └── TaskBadge (🔔)
│       │   │   └── SummaryFooter (대기: N명, 완료: N명)
│       │   └── ConsultationPanel (오른쪽)
│       │       ├── EmptyState (환자 미선택)
│       │       └── ConsultationForm (환자 선택 시)
│       │           ├── PatientHeader
│       │           │   ├── PatientInfo (이름, 나이, 성별)
│       │           │   └── CoordinatorBadge
│       │           ├── MessagesSection (💬 직원 전달사항)
│       │           │   └── MessageCard[]
│       │           ├── NoteTextarea (면담 내용)
│       │           ├── TaskCheckbox (처리 필요 항목)
│       │           ├── TaskExpandedSection (조건부 표시)
│       │           │   ├── TaskTargetRadio (담당코디/간호사/둘다)
│       │           │   └── TaskContentTextarea
│       │           ├── RecentHistorySection (최근 기록 1개월)
│       │           │   └── HistoryItem[]
│       │           └── SubmitButton (진찰 완료 - Enter)
│       └── KeyboardShortcutsHint (하단 가이드)
```

### 2. /doctor/tasks (처리 필요 목록)

```
DoctorTasksPage
├── DoctorLayout
│   └── MainContent
│       ├── PageHeader (처리 필요 항목, 날짜)
│       ├── FilterTabs (전체/미처리만/처리완료)
│       └── TaskTable
│           ├── TableHeader
│           └── TaskRow[]
│               ├── PatientName
│               ├── TaskContent
│               ├── TaskTarget (담당코디/간호사)
│               ├── StatusBadge (미처리/처리완료)
│               └── ActionButton (완료 처리 - 의사용은 조회만)
```

### 3. /doctor/history/[id] (환자별 히스토리)

```
DoctorHistoryPage
├── DoctorLayout
│   └── MainContent
│       ├── PatientHeaderSection
│       │   ├── BackButton
│       │   ├── PatientInfo
│       │   └── CoordinatorInfo
│       ├── DateRangeFilter (기본 1개월)
│       └── HistoryTimeline
│           └── HistoryCard[]
│               ├── DateHeader
│               ├── ConsultationNote
│               ├── TaskInfo (있는 경우)
│               └── DoctorName
```

---

## Features by Priority

### P0 (Must Have) - 진찰 핵심 기능

- [ ] **환자 목록 조회** (오늘 출석 환자)
  - 실시간 출석 상태 (⏳/✓)
  - 전달사항 알림 (💬)
  - 처리 필요 알림 (🔔)

- [ ] **환자 검색**
  - 이름 검색
  - 초성 검색 (ㅎㄱㄷ → 홍길동)
  - Ctrl+K / `/` 단축키

- [ ] **진찰 기록 작성**
  - 면담 내용 입력 (textarea)
  - 처리 필요 항목 체크
  - 지시 대상 선택 (coordinator/nurse/both)
  - 지시 내용 입력

- [ ] **전달사항 확인**
  - 직원이 작성한 메시지 조회
  - 읽음 처리

- [ ] **최근 기록 조회**
  - 환자별 최근 1개월 진찰 기록
  - 접기/펼치기 토글

- [ ] **키보드 단축키**
  - Enter: 진찰 완료
  - Tab: 필드 이동
  - Ctrl+T: 처리 필요 체크 토글
  - Esc: 검색창 포커스

### P1 (Should Have) - 편의 기능

- [ ] **환자 상태 필터링**
  - 전체 / 대기만 / 완료만

- [ ] **처리 필요 목록 페이지**
  - 오늘 지시사항 일괄 조회
  - 필터링 (전체/미처리/완료)

- [ ] **자동 저장**
  - 면담 내용 임시 저장 (localStorage)
  - 페이지 새로고침 시 복원

- [ ] **폴링 (5분 간격)**
  - 환자 목록 자동 갱신
  - 처리 상태 업데이트

### P2 (Nice to Have) - 향후 확장

- [ ] **음성 입력**
  - Web Speech API 활용
  - 면담 내용 음성 입력

- [ ] **환자 히스토리 상세 페이지**
  - /doctor/history/[id]
  - 날짜 범위 필터

- [ ] **통계 대시보드**
  - 오늘 진찰 수
  - 평균 진찰 시간

- [ ] **즐겨찾기 환자**
  - 자주 진찰하는 환자 즐겨찾기
  - 빠른 접근

---

## Data Requirements

### API Endpoints

#### GET /api/doctor/patients/today
**목적**: 오늘 출석 예정 + 실제 출석 + 진찰 여부 조회

**Query Parameters**:
- `date`: 날짜 (기본값: 오늘)
- `status`: 필터 (all/pending/completed)

**Response**:
```typescript
{
  patients: Array<{
    id: string;
    name: string;
    birth_date: string;
    gender: 'M' | 'F';
    coordinator_name: string;
    is_attended: boolean;
    checked_at: string | null;
    is_consulted: boolean;
    has_task: boolean;
    unread_message_count: number;
  }>;
}
```

#### GET /api/doctor/patients/:id/messages
**목적**: 특정 환자의 오늘 전달사항 조회

**Response**:
```typescript
{
  messages: Array<{
    id: string;
    content: string;
    author_name: string;
    author_role: 'coordinator' | 'nurse';
    created_at: string;
    is_read: boolean;
  }>;
}
```

#### PUT /api/doctor/messages/:id/read
**목적**: 전달사항 읽음 처리

**Response**:
```typescript
{
  success: boolean;
}
```

#### GET /api/doctor/patients/:id/history
**목적**: 환자별 최근 진찰 기록 조회

**Query Parameters**:
- `days`: 조회 기간 (기본값: 30일)

**Response**:
```typescript
{
  history: Array<{
    id: string;
    date: string;
    note: string;
    has_task: boolean;
    task_content: string | null;
    task_target: 'coordinator' | 'nurse' | 'both' | null;
    doctor_name: string;
  }>;
}
```

#### POST /api/doctor/consultations
**목적**: 진찰 기록 저장

**Request Body**:
```typescript
{
  patient_id: string;
  date: string;
  note: string;
  has_task: boolean;
  task_content?: string;
  task_target?: 'coordinator' | 'nurse' | 'both';
}
```

**Response**:
```typescript
{
  consultation_id: string;
  task_completions?: Array<{
    id: string;
    role: 'coordinator' | 'nurse';
  }>;
}
```

#### GET /api/doctor/tasks
**목적**: 오늘 처리 필요 항목 조회

**Query Parameters**:
- `date`: 날짜 (기본값: 오늘)
- `status`: 필터 (all/pending/completed)

**Response**:
```typescript
{
  tasks: Array<{
    consultation_id: string;
    patient_name: string;
    task_content: string;
    task_target: 'coordinator' | 'nurse' | 'both';
    coordinator_completed: boolean;
    nurse_completed: boolean;
    created_at: string;
  }>;
}
```

### Client State Management

#### Server State (React Query)
```typescript
// 오늘 출석 환자 목록
useQuery(['doctor', 'patients', 'today', date])

// 환자별 전달사항
useQuery(['doctor', 'patients', patientId, 'messages', date])

// 환자별 히스토리
useQuery(['doctor', 'patients', patientId, 'history', days])

// 처리 필요 목록
useQuery(['doctor', 'tasks', date, status])
```

#### Client State (Zustand)
```typescript
interface DoctorConsultationStore {
  // 선택된 환자
  selectedPatientId: string | null;
  setSelectedPatient: (id: string | null) => void;

  // 검색 상태
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // 임시 저장 (면담 내용)
  draftNotes: Record<string, string>; // patientId -> note
  saveDraftNote: (patientId: string, note: string) => void;
  clearDraftNote: (patientId: string) => void;
}
```

#### Local State (useState)
- 진찰 폼 입력값 (note, has_task, task_target, task_content)
- 검색 포커스 상태
- 모달 표시 상태

---

## Dependencies

### 필요한 컴포넌트
- `@/components/ui/button` (shadcn-ui)
- `@/components/ui/input` (shadcn-ui)
- `@/components/ui/textarea` (shadcn-ui)
- `@/components/ui/checkbox` (shadcn-ui)
- `@/components/ui/radio-group` (shadcn-ui)
- `@/components/ui/badge` (shadcn-ui)
- `@/components/ui/separator` (shadcn-ui)
- `@/components/ui/tabs` (shadcn-ui)

### 외부 라이브러리
- `@tanstack/react-query`: 서버 상태 관리
- `zustand`: 클라이언트 전역 상태 관리
- `react-hook-form`: 폼 관리
- `zod`: 유효성 검사
- `date-fns`: 날짜 포맷팅
- `lucide-react`: 아이콘

### 유틸리티 함수
```typescript
// 초성 검색
function matchesChosung(name: string, query: string): boolean

// 나이 계산
function calculateAge(birthDate: string): number

// 키보드 단축키 핸들러
function useKeyboardShortcuts(shortcuts: Record<string, () => void>)
```

---

## Implementation Order

### Phase 1: 기본 레이아웃 및 라우팅 (2시간)
1. DoctorLayout 컴포넌트 생성
2. TopNavigation (로고, 탭, 사용자 메뉴)
3. 라우팅 설정 (/doctor/consultation, /doctor/tasks)
4. 인증 미들웨어 (role='doctor' 확인)

### Phase 2: 환자 목록 조회 (3시간)
1. GET /api/doctor/patients/today API 구현
2. PatientListPanel 컴포넌트
3. PatientListItem 컴포넌트
4. 상태 아이콘 (⏳/✓/💬/🔔)
5. React Query 연동

### Phase 3: 환자 검색 (2시간)
1. SearchBar 컴포넌트
2. 초성 검색 유틸리티 함수
3. Ctrl+K, `/` 단축키
4. 자동완성 결과 표시

### Phase 4: 진찰 폼 (3시간)
1. ConsultationForm 컴포넌트
2. PatientHeader (환자 정보)
3. NoteTextarea (면담 내용)
4. TaskCheckbox + TaskExpandedSection
5. 폼 유효성 검사 (Zod)

### Phase 5: 전달사항 기능 (2시간)
1. GET /api/doctor/patients/:id/messages API
2. MessagesSection 컴포넌트
3. MessageCard 컴포넌트
4. 읽음 처리 API (PUT /api/doctor/messages/:id/read)

### Phase 6: 진찰 저장 (2시간)
1. POST /api/doctor/consultations API
2. task_completions 자동 생성 로직
3. 성공 후 환자 목록 갱신
4. 낙관적 업데이트 (Optimistic Update)

### Phase 7: 최근 기록 조회 (2시간)
1. GET /api/doctor/patients/:id/history API
2. RecentHistorySection 컴포넌트
3. HistoryItem 컴포넌트
4. 접기/펼치기 토글

### Phase 8: 키보드 단축키 (1시간)
1. useKeyboardShortcuts 커스텀 훅
2. Enter: 진찰 완료
3. Tab: 필드 이동
4. Ctrl+T: 처리 필요 체크 토글
5. Esc: 검색창 포커스

### Phase 9: 처리 필요 목록 페이지 (2시간)
1. GET /api/doctor/tasks API
2. DoctorTasksPage 컴포넌트
3. TaskTable 컴포넌트
4. 필터링 (전체/미처리/완료)

### Phase 10: 폴리싱 (2시간)
1. 로딩 스피너
2. 에러 처리
3. 반응형 스타일링 (데스크탑 우선)
4. 폴링 (5분 간격)
5. 임시 저장 (localStorage)

**총 예상 시간: 21시간**

---

## UI/UX 고려사항

### 키보드 중심 UX
- 모든 주요 액션은 키보드로 수행 가능
- Tab 순서 최적화 (검색 → 환자 선택 → 면담 내용 → 체크박스 → 제출)
- 단축키 가이드 하단에 표시

### 성능 최적화
- 환자 목록 가상 스크롤 (환자 수 많을 경우)
- 진찰 기록 낙관적 업데이트
- 이미지 lazy loading (환자 사진 있는 경우)

### 접근성
- ARIA 레이블
- 키보드 네비게이션
- 포커스 관리

### 에러 처리
- 네트워크 오류: 재시도 버튼
- 유효성 검사 오류: 인라인 메시지
- 저장 실패: 임시 저장 복원 옵션

---

## Testing Strategy

### Unit Tests
- 초성 검색 함수
- 나이 계산 함수
- 폼 유효성 검사

### Integration Tests
- 환자 목록 조회 및 표시
- 진찰 기록 저장 플로우
- 전달사항 읽음 처리

### E2E Tests
- 전체 진찰 프로세스 (환자 선택 → 기록 작성 → 저장)
- 키보드 단축키 동작
- 처리 필요 목록 조회

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

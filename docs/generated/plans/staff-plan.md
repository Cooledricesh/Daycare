# Staff (담당 코디) Implementation Plan

## Overview

담당 코디(사회복지사)가 자신의 담당 환자들을 관리하고, 의사 지시사항을 확인 및 처리하며, 의사에게 전달사항을 작성하는 페이지들을 구현합니다.

**목표**: 모바일 최적화된 반응형 웹 UI로 담당 환자 관리 효율성 극대화

**PRD 참조**: 섹션 2.3 (담당 코디 요구사항), 섹션 7.4 (담당 코디용 화면)

---

## Pages

### 1. `/staff/dashboard` - 담당 환자 대시보드

**목적**: 오늘 담당 환자들의 출석/진찰/지시 상태를 한눈에 확인

**주요 기능**:
- 담당 환자 목록 (카드 형태)
- 환자별 출석/진찰 상태 실시간 표시
- 처리 필요한 지시사항 개수 표시
- 환자 상세 페이지로 이동
- 전달사항 작성 페이지로 이동

### 2. `/staff/patient/[id]` - 환자 상세

**목적**: 특정 환자의 오늘 상태, 지시사항, 전달사항, 히스토리 관리

**주요 기능**:
- 오늘 출석/진찰/활력징후 확인
- 지시사항 확인 및 처리 완료 체크
- 의사에게 전달사항 작성
- 최근 진찰 기록 조회 (접기/펼치기)

### 3. `/staff/messages` - 전달사항 작성

**목적**: 담당 환자 중 선택하여 의사에게 전달사항 작성

**주요 기능**:
- 담당 환자 선택 (드롭다운 또는 검색)
- 전달사항 내용 입력
- 전송 후 대시보드로 복귀

---

## Component Hierarchy

```
StaffLayout (공통 레이아웃)
├── Header
│   ├── Logo
│   ├── HamburgerMenu (모바일)
│   └── UserDropdown (이름, 로그아웃)
└── MobileNav
    ├── NavLink (대시보드)
    ├── NavLink (전달사항 작성)
    └── NavLink (설정)

DashboardPage (/staff/dashboard)
├── StaffLayout
├── DateHeader (오늘 날짜)
├── SummaryCards
│   ├── SummaryCard (출석 인원)
│   ├── SummaryCard (진찰 완료 인원)
│   └── SummaryCard (처리 필요 항목 개수)
└── PatientList
    └── PatientCard[]
        ├── PatientBasicInfo (이름, 출석/진찰 상태)
        ├── TaskIndicator (지시사항 있음 표시)
        └── DetailButton

PatientDetailPage (/staff/patient/[id])
├── StaffLayout
├── BackButton
├── PatientHeader (이름, 나이, 성별)
├── TodayStatus
│   ├── AttendanceStatus (출석 시각)
│   ├── ConsultationStatus (진찰 여부)
│   └── VitalsDisplay (혈압, 혈당)
├── TaskSection (조건부: 지시사항 있는 경우)
│   ├── TaskContent (지시 내용)
│   └── CompleteButton (처리 완료 체크)
├── MessageForm
│   ├── MessageTextarea
│   └── SendButton
└── HistorySection (접기/펼치기)
    └── HistoryList
        └── HistoryItem[] (날짜, 간략 내용)

MessagesPage (/staff/messages)
├── StaffLayout
├── PageTitle
├── PatientSelect (담당 환자 드롭다운)
├── MessageForm
│   ├── MessageTextarea
│   └── SendButton
└── RecentMessages (최근 작성한 전달사항 목록)
```

---

## Features by Priority

### P0 (Must Have) - MVP 필수 기능

#### Dashboard
- [x] 담당 환자 목록 조회 API 연동
- [x] 환자별 출석 상태 표시 (✓/✗)
- [x] 환자별 진찰 상태 표시 (✓/⏳)
- [x] 처리 필요 지시사항 표시 (🔔)
- [x] 요약 카드 (출석/진찰/지시 개수)
- [x] 환자 상세 페이지 이동

#### Patient Detail
- [x] 환자 기본 정보 표시
- [x] 오늘 출석/진찰 상태 표시
- [x] 활력징후 표시 (있는 경우)
- [x] 지시사항 표시 (있는 경우)
- [x] 지시사항 처리 완료 체크
- [x] 전달사항 작성 폼
- [x] 전달사항 전송

#### Messages
- [x] 담당 환자 선택
- [x] 전달사항 내용 입력
- [x] 전달사항 전송

### P1 (Should Have) - 중요하지만 나중에 가능

#### Dashboard
- [ ] 환자 필터링 (전체/출석/미출석)
- [ ] 환자 정렬 (이름순/출석시각순)
- [ ] 새로고침 버튼

#### Patient Detail
- [ ] 최근 진찰 기록 조회 (1개월)
- [ ] 히스토리 상세 보기 (모달)
- [ ] 처리 완료 메모 추가

#### Messages
- [ ] 최근 작성한 전달사항 목록
- [ ] 전달사항 임시저장

### P2 (Nice to Have) - 향후 확장

#### Dashboard
- [ ] 환자 검색 기능
- [ ] 결석 환자 알림
- [ ] Pull-to-refresh

#### Patient Detail
- [ ] 환자 정보 수정 (관리자 권한)
- [ ] 활력징후 차트 (그래프)

#### Messages
- [ ] 전달사항 수정/삭제
- [ ] 읽음 상태 확인

---

## Data Requirements

### API Endpoints

#### 1. GET `/api/staff/my-patients`

**목적**: 로그인한 코디의 담당 환자 목록 조회 (오늘 날짜 기준)

**Query Parameters**:
- `date`: YYYY-MM-DD (기본값: 오늘)

**Response**:
```typescript
{
  patients: [
    {
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
    }
  ];
  summary: {
    total: number;
    attended: number;
    consulted: number;
    pending_tasks: number;
  };
}
```

#### 2. GET `/api/staff/patient/:id`

**목적**: 특정 환자의 상세 정보 조회 (오늘 날짜 기준)

**Response**:
```typescript
{
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
    };
    vitals: {
      systolic: number | null;
      diastolic: number | null;
      blood_sugar: number | null;
    } | null;
    task: {
      id: string;
      content: string;
      is_completed: boolean;
      completed_at: string | null;
    } | null;
  };
  history: [
    {
      date: string;
      note: string;
      doctor_name: string;
    }
  ];
}
```

#### 3. POST `/api/staff/task/:taskId/complete`

**목적**: 지시사항 처리 완료 체크

**Request Body**:
```typescript
{
  memo?: string; // 처리 메모 (선택)
}
```

**Response**:
```typescript
{
  success: true;
  completed_at: string;
}
```

#### 4. POST `/api/staff/messages`

**목적**: 의사에게 전달사항 작성

**Request Body**:
```typescript
{
  patient_id: string;
  content: string;
  date?: string; // 기본값: 오늘
}
```

**Response**:
```typescript
{
  success: true;
  message: {
    id: string;
    created_at: string;
  };
}
```

#### 5. GET `/api/staff/messages/recent`

**목적**: 최근 작성한 전달사항 목록 (선택적)

**Query Parameters**:
- `limit`: number (기본값: 10)

**Response**:
```typescript
{
  messages: [
    {
      id: string;
      patient_name: string;
      content: string;
      created_at: string;
      is_read: boolean;
    }
  ];
}
```

### State Management

#### Server State (React Query)
- `useMyPatients`: 담당 환자 목록
- `usePatientDetail`: 환자 상세 정보
- `useRecentMessages`: 최근 전달사항 (선택적)

#### Client State (Zustand) - 선택적
- 현재 선택된 환자 ID (페이지 간 공유 필요시)

#### Local State (useState)
- 전달사항 입력 내용
- 히스토리 섹션 펼침/접힘 상태
- 로딩/에러 상태

---

## Dependencies

### 필요한 공통 컴포넌트
- `Button`: shadcn-ui
- `Card`: shadcn-ui
- `Badge`: shadcn-ui
- `Textarea`: shadcn-ui
- `Select`: shadcn-ui (환자 선택용)
- `Skeleton`: shadcn-ui (로딩 상태)
- `Alert`: shadcn-ui (에러 메시지)

### 필요한 외부 라이브러리
- `@tanstack/react-query`: 서버 상태 관리
- `date-fns`: 날짜 포맷팅
- `lucide-react`: 아이콘 (Check, AlertCircle, MessageSquare 등)
- `react-hook-form` + `zod`: 폼 유효성 검사

### 필요한 Hooks
- `useAuth`: 현재 로그인한 코디 정보
- `useToast`: 알림 메시지 표시

---

## Implementation Order

### Phase 1: 기본 레이아웃 및 인증 (1-2시간)
1. StaffLayout 컴포넌트 생성
2. 인증 미들웨어 적용 (role='coordinator' 확인)
3. 공통 Header, MobileNav 구현

### Phase 2: Dashboard 페이지 (3-4시간)
1. `/api/staff/my-patients` API 구현
2. DashboardPage 컴포넌트 구현
3. SummaryCards 구현
4. PatientCard 컴포넌트 구현
5. React Query 연동

### Phase 3: Patient Detail 페이지 (3-4시간)
1. `/api/staff/patient/:id` API 구현
2. PatientDetailPage 컴포넌트 구현
3. TodayStatus 섹션 구현
4. TaskSection 구현
5. `/api/staff/task/:taskId/complete` API 구현
6. MessageForm 구현
7. `/api/staff/messages` POST API 구현

### Phase 4: Messages 페이지 (1-2시간)
1. MessagesPage 컴포넌트 구현
2. PatientSelect 구현
3. MessageForm 재사용 또는 별도 구현
4. 최근 전달사항 목록 (선택적)

### Phase 5: 모바일 최적화 및 테스트 (2-3시간)
1. 반응형 레이아웃 조정 (< 768px)
2. 터치 영역 최적화 (최소 44px)
3. 에러 처리 및 로딩 상태 UI
4. E2E 테스트

---

## Mobile Optimization

### Breakpoints
- **Mobile**: < 768px - 단일 컬럼, 햄버거 메뉴
- **Tablet**: 768px ~ 1024px - 2컬럼 가능
- **Desktop**: > 1024px - 사이드바 + 메인 컨텐츠

### Touch Optimization
- 모든 버튼 최소 높이: 44px
- 터치 영역 최소: 48px x 48px
- 카드 간격: 16px 이상
- 스크롤 영역 충분한 패딩

### Performance
- 목록 가상화 (환자 수가 많을 경우)
- 이미지 지연 로딩
- 폴링 간격: 1분 (배터리 고려)

---

## Error Handling

### 네트워크 오류
- "목록을 불러올 수 없습니다. 다시 시도해주세요" + 재시도 버튼

### 권한 오류
- 담당 환자가 아닌 경우: "접근 권한이 없습니다" → 대시보드로 리다이렉트

### 유효성 검사
- 전달사항 내용 필수: "전달사항 내용을 입력해주세요"
- 환자 미선택: "환자를 선택해주세요"

---

## Accessibility

- 키보드 네비게이션 지원
- ARIA 레이블 추가
- 색상 대비 비율 4.5:1 이상
- 포커스 표시 명확하게

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

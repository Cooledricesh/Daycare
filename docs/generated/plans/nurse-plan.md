# Nurse (간호사) Implementation Plan

## Overview

간호사가 오늘 처방 변경 건을 확인하고 처리하며, 필요시 의사에게 전달사항을 작성하는 페이지를 구현합니다.

**목표**: 모바일 최적화된 반응형 웹 UI로 처방 변경 관리 효율성 극대화

**PRD 참조**: 섹션 2.3 (낮병동 간호사 요구사항), 섹션 7.5 (간호사용 화면)

---

## Pages

### 1. `/nurse/prescriptions` - 처방 변경 목록

**목적**: 오늘 처방/약 변경 건을 확인하고 처리 완료 체크

**주요 기능**:
- 오늘 처방 변경 건 목록 (카드 형태)
- 필터링 (전체/미처리/완료)
- 처리 완료 체크
- 환자 상세 정보 보기 (모달 또는 확장)
- 전달사항 작성

---

## Component Hierarchy

```
NurseLayout (공통 레이아웃)
├── Header
│   ├── Logo
│   ├── HamburgerMenu (모바일)
│   └── UserDropdown (이름, 로그아웃)
└── MobileNav
    ├── NavLink (처방 변경)
    └── NavLink (설정)

PrescriptionsPage (/nurse/prescriptions)
├── NurseLayout
├── PageHeader
│   ├── DateDisplay (오늘 날짜)
│   └── SummaryBadge (총 건수)
├── FilterTabs
│   ├── Tab (전체)
│   ├── Tab (미처리)
│   └── Tab (완료)
├── PrescriptionList
│   └── PrescriptionCard[]
│       ├── PatientInfo (이름, 담당 코디)
│       ├── TaskContent (지시 내용)
│       ├── TaskStatus (처리 상태)
│       ├── CompleteCheckbox (미완료인 경우)
│       └── DetailButton (상세 보기)
└── CreateMessageButton (플로팅 버튼)

PrescriptionDetailModal (선택적)
├── ModalHeader
│   ├── PatientName
│   └── CloseButton
├── ModalBody
│   ├── PatientBasicInfo (나이, 성별, 담당 코디)
│   ├── ConsultationInfo (진찰 날짜, 의사 이름)
│   ├── TaskContent (지시 내용)
│   └── TaskStatus (처리 상태)
└── ModalFooter
    └── CompleteButton (미완료인 경우)

MessageModal
├── ModalHeader
│   ├── Title (전달사항 작성)
│   └── CloseButton
├── ModalBody
│   ├── PatientSelect (환자 선택)
│   └── MessageTextarea
└── ModalFooter
    └── SendButton
```

---

## Features by Priority

### P0 (Must Have) - MVP 필수 기능

#### Prescriptions Page
- [x] 오늘 처방 변경 목록 조회 API 연동
- [x] 환자별 처방 변경 카드 표시
- [x] 필터 탭 (전체/미처리/완료)
- [x] 처리 완료 체크박스
- [x] 처리 완료 API 호출
- [x] 처리 완료 후 목록 갱신

#### Message Modal
- [x] 전달사항 작성 모달
- [x] 환자 선택 (담당 환자 아님, 전체 환자)
- [x] 전달사항 내용 입력
- [x] 전달사항 전송

### P1 (Should Have) - 중요하지만 나중에 가능

#### Prescriptions Page
- [ ] 환자 상세 정보 모달
- [ ] 환자 검색 기능
- [ ] 새로고침 버튼
- [ ] 처리 완료 메모 추가

#### Message Modal
- [ ] 최근 작성한 전달사항 목록
- [ ] 환자 검색 (드롭다운 내)

### P2 (Nice to Have) - 향후 확장

#### Prescriptions Page
- [ ] 처방 변경 건 정렬 (시간순/환자명순)
- [ ] 처리 완료 취소 기능
- [ ] Pull-to-refresh

#### Message Modal
- [ ] 전달사항 임시저장
- [ ] 읽음 상태 확인

---

## Data Requirements

### API Endpoints

#### 1. GET `/api/nurse/prescriptions`

**목적**: 오늘 처방 변경 건 목록 조회

**Query Parameters**:
- `date`: YYYY-MM-DD (기본값: 오늘)
- `filter`: 'all' | 'pending' | 'completed' (기본값: 'all')

**Response**:
```typescript
{
  prescriptions: [
    {
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
        created_at: string;
      };
      task: {
        id: string; // task_completion.id
        is_completed: boolean;
        completed_at: string | null;
        completed_by_name: string | null;
      };
    }
  ];
  summary: {
    total: number;
    pending: number;
    completed: number;
  };
}
```

#### 2. POST `/api/nurse/task/:taskId/complete`

**목적**: 처방 변경 건 처리 완료 체크

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

#### 3. GET `/api/nurse/patients` (전달사항 작성용)

**목적**: 전체 활성 환자 목록 조회 (전달사항 작성 시 환자 선택용)

**Response**:
```typescript
{
  patients: [
    {
      id: string;
      name: string;
      coordinator_name: string | null;
    }
  ];
}
```

#### 4. POST `/api/nurse/messages`

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

### State Management

#### Server State (React Query)
- `usePrescriptions`: 처방 변경 목록
- `usePatients`: 전체 환자 목록 (전달사항 작성용)

#### Client State (Zustand) - 선택적
- 없음 (인증 정보는 공통 AuthStore 사용)

#### Local State (useState)
- 필터 탭 상태 ('all' | 'pending' | 'completed')
- 전달사항 모달 열림/닫힘 상태
- 상세 정보 모달 열림/닫힘 상태 (선택적)
- 선택된 환자 ID (전달사항 작성 시)

---

## Dependencies

### 필요한 공통 컴포넌트
- `Button`: shadcn-ui
- `Card`: shadcn-ui
- `Badge`: shadcn-ui
- `Checkbox`: shadcn-ui
- `Tabs`: shadcn-ui (필터링)
- `Dialog`: shadcn-ui (모달)
- `Select`: shadcn-ui (환자 선택)
- `Textarea`: shadcn-ui
- `Skeleton`: shadcn-ui (로딩 상태)
- `Alert`: shadcn-ui (에러 메시지)

### 필요한 외부 라이브러리
- `@tanstack/react-query`: 서버 상태 관리
- `date-fns`: 날짜 포맷팅
- `lucide-react`: 아이콘 (Check, Filter, MessageSquare 등)
- `react-hook-form` + `zod`: 폼 유효성 검사

### 필요한 Hooks
- `useAuth`: 현재 로그인한 간호사 정보
- `useToast`: 알림 메시지 표시

---

## Implementation Order

### Phase 1: 기본 레이아웃 및 인증 (1시간)
1. NurseLayout 컴포넌트 생성
2. 인증 미들웨어 적용 (role='nurse' 확인)
3. 공통 Header, MobileNav 구현

### Phase 2: Prescriptions Page (3-4시간)
1. `/api/nurse/prescriptions` API 구현
2. PrescriptionsPage 컴포넌트 구현
3. FilterTabs 구현
4. PrescriptionCard 컴포넌트 구현
5. React Query 연동
6. `/api/nurse/task/:taskId/complete` API 구현
7. 처리 완료 체크 기능 구현

### Phase 3: Message Modal (2시간)
1. `/api/nurse/patients` API 구현
2. MessageModal 컴포넌트 구현
3. 환자 선택 드롭다운 구현
4. `/api/nurse/messages` POST API 구현
5. 전달사항 전송 기능 구현

### Phase 4: 모바일 최적화 및 테스트 (1-2시간)
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
- 체크박스 터치 영역: 48px x 48px
- 카드 간격: 16px 이상
- 플로팅 버튼 크기: 56px x 56px

### Performance
- 목록 가상화 (처방 변경 건이 많을 경우)
- 폴링 간격: 1분 (배터리 고려)

---

## Error Handling

### 네트워크 오류
- "목록을 불러올 수 없습니다. 다시 시도해주세요" + 재시도 버튼

### 권한 오류
- 역할이 'nurse'가 아닌 경우: 로그인 페이지로 리다이렉트

### 유효성 검사
- 전달사항 내용 필수: "전달사항 내용을 입력해주세요"
- 환자 미선택: "환자를 선택해주세요"

---

## Accessibility

- 키보드 네비게이션 지원
- ARIA 레이블 추가
- 색상 대비 비율 4.5:1 이상
- 포커스 표시 명확하게
- 체크박스 접근성 (label 연결)

---

## UI/UX Details

### Filter Tabs

**디자인**:
- 세그먼트 컨트롤 형태
- 활성 탭 강조 (primary 색상)
- 각 탭에 개수 표시 (예: "미처리 (5)")

**동작**:
- 탭 클릭 시 필터 변경
- URL 쿼리에 필터 상태 반영 (`?filter=pending`)
- 필터 변경 시 목록 자동 갱신

### Prescription Card

**레이아웃** (모바일):
```
┌─────────────────────────────────────┐
│ 홍길동                 ☐ 처리 완료  │
│ 담당: 김코디                        │
│ 졸피뎀 10mg → 15mg 증량             │
│                          [상세]     │
└─────────────────────────────────────┘
```

**상태별 스타일**:
- 미처리: 흰색 배경, 체크박스 활성
- 완료: 회색 배경, 체크박스 비활성 + 체크 표시
- 처리 완료 시각 표시 (작은 글씨)

### Floating Button (전달사항 작성)

**위치**: 화면 우하단 고정
**크기**: 56px x 56px (모바일)
**아이콘**: MessageSquare (lucide-react)
**색상**: Primary (파란색)
**애니메이션**: 클릭 시 ripple effect

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

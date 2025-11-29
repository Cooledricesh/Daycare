# Patient Page Implementation Plan

## Overview

환자용 출석 체크 페이지. 환자가 병원 내 태블릿/데스크탑에서 이름을 검색하여 본인을 선택하고 출석을 체크합니다. 선택적으로 활력징후(혈압, 혈당)를 입력할 수 있습니다.

- **페이지 경로**: `/patient`
- **인증**: 불필요 (병원 내 기기에서만 접근)
- **주요 목적**: 환자 자가 출석 체크 및 활력징후 입력
- **PRD 참조**: 섹션 2.3 (환자), 섹션 7.1 (환자용 화면)

## Component Hierarchy

```
PatientCheckInPage
├── PatientSearchSection
│   ├── DateDisplay (오늘 날짜)
│   ├── SearchInput (이름 검색)
│   └── AutocompleteList (자동완성 목록)
├── ConfirmationModal (출석 확인)
│   ├── PatientInfo (환자 정보 표시)
│   └── ActionButtons (아니오/예)
├── VitalsInputSection (활력징후 입력)
│   ├── BloodPressureInput (혈압)
│   ├── BloodSugarInput (혈당)
│   └── ActionButtons (건너뛰기/저장)
└── CompletionScreen (완료 화면)
    ├── SuccessMessage
    └── AutoRedirectTimer (5초 타이머)
```

## Features by Priority

### P0 (Must Have)

- [x] 오늘 날짜 표시 (큰 글씨)
- [x] 이름 검색 입력창 (자동완성)
- [x] 환자 목록 조회 (활성 환자만)
- [x] 출석 확인 모달
- [x] 출석 기록 저장 API 호출
- [x] 완료 화면 표시 및 자동 리다이렉트 (5초)
- [x] 큰 글씨/버튼 스타일 (접근성)

### P1 (Should Have)

- [x] 활력징후 입력 화면
- [x] 혈압 입력 (수축기/이완기)
- [x] 혈당 입력
- [x] 활력징후 저장 API 호출
- [x] 건너뛰기 기능
- [x] 이미 출석한 환자 체크 및 안내

### P2 (Nice to Have)

- [ ] 터치 최적화 (드래그 방지)
- [ ] 키보드 입력 가이드 (숫자만 입력)
- [ ] 활력징후 입력값 유효성 검사 (범위)
- [ ] 애니메이션 효과 (화면 전환)

## Data Requirements

### API Endpoints

#### 1. GET /api/patients/search
- **용도**: 환자 이름 검색 (자동완성)
- **Query Params**: `q` (검색어)
- **Response**: 환자 목록 (이름, ID)

#### 2. POST /api/attendances
- **용도**: 출석 기록 저장
- **Request Body**: `{ patient_id, date }`
- **Response**: 출석 기록 정보

#### 3. POST /api/vitals
- **용도**: 활력징후 저장
- **Request Body**: `{ patient_id, date, systolic, diastolic, blood_sugar, memo }`
- **Response**: 활력징후 기록 정보

#### 4. GET /api/attendances/check
- **용도**: 출석 여부 확인
- **Query Params**: `patient_id`, `date`
- **Response**: `{ is_attended: boolean }`

### 상태 관리 요구사항

- **useState**: 단계별 화면 상태 (search, confirm, vitals, complete)
- **useState**: 선택된 환자 정보
- **useState**: 검색어 입력값
- **useState**: 활력징후 입력값 (systolic, diastolic, blood_sugar)
- **React Query**: 환자 검색, 출석/활력징후 저장 Mutation

## Dependencies

### 외부 라이브러리

- `@tanstack/react-query`: API 호출 및 상태 관리
- `date-fns`: 날짜 포맷팅
- `zod`: 입력값 검증
- `lucide-react`: 아이콘 (CheckCircle, Search 등)

### 내부 컴포넌트

- `@/components/ui/input`: 입력 필드
- `@/components/ui/button`: 버튼
- `@/components/ui/dialog`: 모달 (확인 화면)
- `@/lib/remote/api-client`: API 호출 클라이언트

## Implementation Steps

1. **페이지 기본 구조 생성**
   - `src/app/patient/page.tsx` 생성
   - 단계별 상태 관리 (step: 'search' | 'confirm' | 'vitals' | 'complete')

2. **검색 화면 구현**
   - 오늘 날짜 표시 (큰 글씨)
   - 이름 검색 입력창
   - 자동완성 목록 (환자 클릭 시 확인 모달 표시)

3. **출석 확인 모달 구현**
   - 환자 이름 표시
   - "출석하시겠습니까?" 메시지
   - "아니오" (모달 닫기) / "예" (출석 저장) 버튼

4. **출석 저장 로직**
   - POST /api/attendances API 호출
   - 성공 시 활력징후 입력 화면으로 전환
   - 실패 시 오류 메시지 표시

5. **활력징후 입력 화면**
   - 출석 완료 메시지
   - 혈압 입력 (수축기/이완기)
   - 혈당 입력
   - "건너뛰기" / "저장" 버튼

6. **완료 화면**
   - 성공 메시지 표시
   - 5초 타이머 (자동 리다이렉트)
   - "처음으로" 버튼 (즉시 리다이렉트)

7. **스타일링 및 접근성**
   - 글씨 크기 최소 24px
   - 버튼/입력창 높이 60px 이상
   - 터치 영역 50px 이상
   - 색상 대비 확보 (WCAG AA 기준)

## Design Specifications

### 타이포그래피

- **제목**: 2.5rem (40px), font-bold
- **본문**: 1.5rem (24px), font-medium
- **버튼 텍스트**: 1.5rem (24px), font-semibold

### 간격 및 크기

- **입력창 높이**: 60px
- **버튼 높이**: 60px
- **터치 영역**: 최소 50px
- **자동완성 항목 높이**: 50px
- **섹션 간격**: 2rem (32px)

### 색상

- **Primary (출석 체크)**: bg-primary (파란색)
- **Success (완료)**: bg-green-500
- **배경**: bg-gray-50
- **텍스트**: text-gray-900

## Error Handling

| 에러 상황 | 처리 방법 |
|----------|----------|
| 검색 결과 없음 | "검색 결과가 없습니다" 메시지 표시 |
| 이미 출석한 환자 | "이미 출석하셨습니다" 알림 후 처음으로 |
| 출석 저장 실패 | "출석 체크에 실패했습니다. 다시 시도해주세요" |
| 활력징후 저장 실패 | "활력징후 저장에 실패했습니다. 직원에게 문의하세요" |
| 네트워크 오류 | "네트워크 연결을 확인해주세요" |

## Accessibility

- 키보드 네비게이션 지원
- 큰 터치 영역 (모바일 최적화)
- 명확한 시각적 피드백
- 단순한 단계 (2-3단계 이내 완료)

## Testing Checklist

- [ ] 이름 검색 및 자동완성 동작
- [ ] 출석 확인 모달 표시 및 취소
- [ ] 출석 기록 저장 성공
- [ ] 이미 출석한 환자 체크
- [ ] 활력징후 입력 및 저장
- [ ] 활력징후 건너뛰기
- [ ] 완료 화면 표시 및 자동 리다이렉트
- [ ] 오류 메시지 표시 (네트워크 오류 등)
- [ ] 모바일/태블릿 반응형 확인

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

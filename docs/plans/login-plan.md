# Login Page Implementation Plan

## Overview

직원 및 의사를 위한 로그인 페이지. ID와 비밀번호를 입력하여 인증하고, JWT 토큰을 발급받아 httpOnly 쿠키에 저장합니다. 역할(role)에 따라 적절한 대시보드로 리다이렉트됩니다.

- **페이지 경로**: `/login`
- **인증**: 불필요 (로그인 페이지)
- **주요 목적**: 직원/의사 인증 및 역할별 리다이렉트
- **PRD 참조**: 섹션 2.3 (사용자 역할), 섹션 4.2 (직원/의사용 인증), 섹션 7.2 (로그인 화면)

## Component Hierarchy

```
LoginPage
├── LoginHeader
│   ├── Logo
│   └── Title ("낮병원 환자관리")
├── LoginForm
│   ├── LoginIdInput
│   ├── PasswordInput
│   ├── SubmitButton ("로그인")
│   └── ErrorMessage
└── LoginFooter
    └── HelpText ("비밀번호를 잊으셨나요? → 관리자에게 문의하세요")
```

## Features by Priority

### P0 (Must Have)

- [x] 로그인 폼 UI (ID, 비밀번호, 로그인 버튼)
- [x] 로그인 API 호출 (POST /api/auth/login)
- [x] JWT 토큰 발급 및 httpOnly 쿠키 저장
- [x] 역할별 리다이렉트
  - doctor → `/doctor/consultation`
  - coordinator → `/staff/dashboard`
  - nurse → `/nurse/prescriptions`
  - admin → `/admin/patients`
- [x] 입력값 검증 (Zod)
- [x] 에러 메시지 표시 (ID/비밀번호 불일치, 비활성 계정 등)

### P1 (Should Have)

- [x] 로딩 상태 표시 (로그인 버튼 비활성화)
- [x] Enter 키로 로그인 제출
- [x] 비밀번호 표시/숨김 토글
- [x] 자동 포커스 (ID 입력창)

### P2 (Nice to Have)

- [ ] Remember Me (로그인 ID 저장)
- [ ] 로그인 실패 횟수 제한 (Rate Limiting)
- [ ] 다크 모드 지원
- [ ] 애니메이션 (폼 제출, 에러 메시지)

## Data Requirements

### API Endpoints

#### 1. POST /api/auth/login
- **용도**: 로그인 인증 및 JWT 토큰 발급
- **Request Body**: `{ login_id, password }`
- **Response**: `{ success, data: { user, token } }`
- **Set-Cookie**: `auth_token=<JWT>; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`

#### 2. GET /api/auth/me (선택)
- **용도**: 현재 로그인한 사용자 정보 조회
- **Response**: `{ success, data: { id, login_id, name, role } }`

### 상태 관리 요구사항

- **useState**: 입력값 (login_id, password)
- **useState**: 에러 메시지
- **useState**: 비밀번호 표시/숨김 상태
- **React Query**: 로그인 Mutation

## Dependencies

### 외부 라이브러리

- `@tanstack/react-query`: 로그인 API 호출
- `zod`: 입력값 검증
- `react-hook-form`: 폼 상태 관리 및 검증
- `lucide-react`: 아이콘 (Eye, EyeOff 등)
- `next/navigation`: 리다이렉트 (useRouter)

### 내부 컴포넌트

- `@/components/ui/input`: 입력 필드
- `@/components/ui/button`: 버튼
- `@/components/ui/label`: 라벨
- `@/lib/remote/api-client`: API 호출 클라이언트

## Implementation Steps

1. **페이지 기본 구조 생성**
   - `src/app/login/page.tsx` 생성
   - 중앙 정렬 레이아웃 (카드 형태)

2. **로그인 폼 구현**
   - react-hook-form으로 폼 상태 관리
   - Zod 스키마로 입력값 검증
   - ID, 비밀번호 입력 필드

3. **로그인 API 연동**
   - POST /api/auth/login 호출
   - 성공 시: JWT 토큰을 httpOnly 쿠키에 저장 (서버에서 처리)
   - 실패 시: 에러 메시지 표시

4. **역할별 리다이렉트**
   - 로그인 응답의 `user.role`에 따라 분기
   - Next.js `useRouter`로 페이지 이동

5. **에러 처리**
   - 401: "아이디 또는 비밀번호가 일치하지 않습니다"
   - 403: "비활성화된 계정입니다. 관리자에게 문의하세요"
   - 500: "로그인에 실패했습니다. 다시 시도해주세요"

6. **UX 개선**
   - 로딩 중 버튼 비활성화 및 로딩 스피너 표시
   - Enter 키로 폼 제출
   - 비밀번호 표시/숨김 토글 버튼

7. **스타일링**
   - 중앙 정렬 카드 레이아웃
   - 반응형 디자인 (모바일/데스크탑)
   - 명확한 시각적 피드백 (에러 메시지, 포커스 상태)

## Design Specifications

### 레이아웃

- **카드 크기**: 최대 400px (데스크탑), 90% (모바일)
- **중앙 정렬**: `min-h-screen flex items-center justify-center`
- **배경색**: `bg-gray-100`
- **카드 배경**: `bg-white`, `shadow-lg`, `rounded-lg`

### 타이포그래피

- **제목**: 1.75rem (28px), font-bold
- **라벨**: 0.875rem (14px), font-medium
- **입력 필드**: 1rem (16px)
- **버튼 텍스트**: 1rem (16px), font-semibold

### 간격 및 크기

- **입력창 높이**: 40px
- **버튼 높이**: 44px
- **카드 패딩**: 2rem (32px)
- **필드 간격**: 1.5rem (24px)

### 색상

- **Primary (로그인 버튼)**: bg-primary (파란색)
- **에러 메시지**: text-red-600
- **배경**: bg-gray-100
- **카드 배경**: bg-white

## Error Handling

| 에러 상황 | 처리 방법 |
|----------|----------|
| ID 또는 비밀번호 미입력 | "아이디와 비밀번호를 입력해주세요" (클라이언트 검증) |
| ID 또는 비밀번호 불일치 | "아이디 또는 비밀번호가 일치하지 않습니다" (401) |
| 비활성화된 계정 | "비활성화된 계정입니다. 관리자에게 문의하세요" (403) |
| 네트워크 오류 | "로그인에 실패했습니다. 다시 시도해주세요" |
| 서버 오류 | "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요" (500) |

## Security

- JWT 토큰은 httpOnly 쿠키로 저장 (XSS 방지)
- Secure 플래그 사용 (HTTPS only)
- SameSite=Strict (CSRF 방지)
- 비밀번호는 서버에서 bcrypt로 검증
- 클라이언트에서 비밀번호 해싱하지 않음 (HTTPS로 전송)

## Accessibility

- `<form>` 태그 사용 (Enter 키 제출)
- `<label>` 태그로 입력 필드 연결
- `aria-invalid` 속성으로 에러 상태 표시
- 에러 메시지에 `role="alert"` 사용
- 키보드 네비게이션 지원 (Tab, Enter)

## Testing Checklist

- [ ] ID, 비밀번호 입력 및 폼 제출
- [ ] 로그인 성공 시 역할별 리다이렉트
  - [ ] doctor → `/doctor/consultation`
  - [ ] coordinator → `/staff/dashboard`
  - [ ] nurse → `/nurse/prescriptions`
  - [ ] admin → `/admin/patients`
- [ ] 로그인 실패 시 에러 메시지 표시
- [ ] 비활성화된 계정 로그인 시도
- [ ] 네트워크 오류 처리
- [ ] Enter 키로 폼 제출
- [ ] 비밀번호 표시/숨김 토글
- [ ] 로딩 상태 표시 (버튼 비활성화)
- [ ] 모바일/데스크탑 반응형 확인

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

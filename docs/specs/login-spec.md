# Login Page Technical Specification

## Overview

로그인 페이지의 기술 명세서. API 엔드포인트, 컴포넌트 인터페이스, JWT 토큰 발급 및 쿠키 설정, 검증 규칙을 정의합니다.

## API Endpoints

### POST /api/auth/login

**Purpose**: 직원/의사 로그인 인증 및 JWT 토큰 발급

**Request Body**:
```typescript
interface LoginRequest {
  login_id: string;
  password: string;
}
```

**Response** (200 OK):
```typescript
interface LoginResponse {
  success: true;
  data: {
    user: {
      id: string;
      login_id: string;
      name: string;
      role: 'doctor' | 'coordinator' | 'nurse' | 'admin';
      is_active: boolean;
    };
    token: string; // JWT 토큰 (클라이언트에서 사용 안 함, 쿠키에만 저장)
  };
}
```

**Set-Cookie Header**:
```
Set-Cookie: auth_token=<JWT_TOKEN>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800
```

- `HttpOnly`: JavaScript에서 접근 불가 (XSS 방지)
- `Secure`: HTTPS에서만 전송
- `SameSite=Strict`: CSRF 방지
- `Max-Age=28800`: 8시간 (28800초)

**Error Codes**:
- `400`: Bad Request - 잘못된 요청 (필수 필드 누락)
- `401`: Unauthorized - ID 또는 비밀번호 불일치
- `403`: Forbidden - 비활성화된 계정
- `500`: Internal Server Error

**Server Logic**:
```typescript
// src/features/auth/backend/service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

async function login(login_id: string, password: string) {
  // 1. staff 조회
  const staff = await supabase
    .from('staff')
    .select('*')
    .eq('login_id', login_id)
    .single();

  if (!staff) {
    throw new UnauthorizedError('아이디 또는 비밀번호가 일치하지 않습니다');
  }

  // 2. 비밀번호 검증
  const isValidPassword = await bcrypt.compare(password, staff.password_hash);

  if (!isValidPassword) {
    throw new UnauthorizedError('아이디 또는 비밀번호가 일치하지 않습니다');
  }

  // 3. is_active 확인
  if (!staff.is_active) {
    throw new ForbiddenError('비활성화된 계정입니다. 관리자에게 문의하세요');
  }

  // 4. JWT 토큰 생성
  const token = jwt.sign(
    {
      id: staff.id,
      login_id: staff.login_id,
      name: staff.name,
      role: staff.role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  return {
    user: {
      id: staff.id,
      login_id: staff.login_id,
      name: staff.name,
      role: staff.role,
      is_active: staff.is_active,
    },
    token,
  };
}
```

**SQL**:
```sql
SELECT id, login_id, password_hash, name, role, is_active
FROM staff
WHERE login_id = :login_id
LIMIT 1;
```

---

### GET /api/auth/me (선택)

**Purpose**: 현재 로그인한 사용자 정보 조회 (JWT 검증)

**Headers**:
```
Cookie: auth_token=<JWT_TOKEN>
```

**Response** (200 OK):
```typescript
interface MeResponse {
  success: true;
  data: {
    id: string;
    login_id: string;
    name: string;
    role: 'doctor' | 'coordinator' | 'nurse' | 'admin';
  };
}
```

**Error Codes**:
- `401`: Unauthorized - 토큰 없음 또는 만료
- `500`: Internal Server Error

---

### POST /api/auth/logout (선택)

**Purpose**: 로그아웃 (쿠키 삭제)

**Response** (200 OK):
```typescript
interface LogoutResponse {
  success: true;
  data: null;
}
```

**Set-Cookie Header** (쿠키 삭제):
```
Set-Cookie: auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0
```

---

## Components

### LoginPage

**Props**: None (페이지 컴포넌트)

**State**:
```typescript
interface LoginPageState {
  // react-hook-form으로 관리
  form: {
    login_id: string;
    password: string;
  };
  showPassword: boolean; // 비밀번호 표시/숨김
  errorMessage: string | null; // 로그인 실패 시 에러 메시지
}
```

**Behavior**:
- 초기 렌더링 시 ID 입력창에 자동 포커스
- 폼 제출 시 로그인 Mutation 실행
- 성공 시: 역할별 리다이렉트
- 실패 시: 에러 메시지 표시

---

### LoginForm

**Props**:
```typescript
interface LoginFormProps {
  onSubmit: (data: LoginRequest) => void;
  isLoading: boolean;
  errorMessage: string | null;
}
```

**State**:
```typescript
interface LoginFormState {
  showPassword: boolean;
}
```

**Behavior**:
- react-hook-form으로 폼 상태 관리
- Zod 스키마로 입력값 검증
- Enter 키로 폼 제출
- 로딩 중 버튼 비활성화
- 비밀번호 표시/숨김 토글

---

## Validation Rules

### 로그인 요청 검증

```typescript
import { z } from 'zod';

const loginSchema = z.object({
  login_id: z
    .string()
    .min(1, '아이디를 입력해주세요')
    .max(50, '아이디는 50자 이내로 입력해주세요'),
  password: z
    .string()
    .min(1, '비밀번호를 입력해주세요')
    .max(100, '비밀번호는 100자 이내로 입력해주세요'),
});

type LoginFormData = z.infer<typeof loginSchema>;
```

---

## JWT Token Specification

### Payload

```typescript
interface JwtPayload {
  id: string; // staff.id
  login_id: string; // staff.login_id
  name: string; // staff.name
  role: 'doctor' | 'coordinator' | 'nurse' | 'admin';
  iat: number; // issued at (UNIX timestamp)
  exp: number; // expiration (UNIX timestamp, iat + 8h)
}
```

### Environment Variables

```env
JWT_SECRET=<랜덤 시크릿 키, 최소 32자>
JWT_EXPIRES_IN=8h
```

### 토큰 생성 예시

```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    id: staff.id,
    login_id: staff.login_id,
    name: staff.name,
    role: staff.role,
  },
  process.env.JWT_SECRET!,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
);
```

### 토큰 검증 예시

```typescript
import jwt from 'jsonwebtoken';

function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new UnauthorizedError('유효하지 않은 토큰입니다');
  }
}
```

---

## React Hook Form Integration

### useLoginForm

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from './schema';

function useLoginForm() {
  return useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login_id: '',
      password: '',
    },
  });
}
```

### LoginPage 구현 예시

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogin } from '@/features/auth/hooks';
import { loginSchema, LoginFormData } from '@/features/auth/schema';

export default function LoginPage() {
  const router = useRouter();
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login_id: '', password: '' },
  });

  const login = useLogin();

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await login.mutateAsync(data);

      // 역할별 리다이렉트
      const redirectMap: Record<string, string> = {
        doctor: '/doctor/consultation',
        coordinator: '/staff/dashboard',
        nurse: '/nurse/prescriptions',
        admin: '/admin/patients',
      };

      const redirectUrl = redirectMap[response.user.role];
      router.push(redirectUrl);
    } catch (error) {
      // 에러 처리는 useLogin에서 관리
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">낮병원 환자관리</h1>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="login_id" className="block text-sm font-medium mb-1">
              아이디
            </label>
            <input
              id="login_id"
              type="text"
              {...form.register('login_id')}
              className="w-full px-3 py-2 border rounded-md"
              autoFocus
            />
            {form.formState.errors.login_id && (
              <p className="text-red-600 text-sm mt-1">
                {form.formState.errors.login_id.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              {...form.register('password')}
              className="w-full px-3 py-2 border rounded-md"
            />
            {form.formState.errors.password && (
              <p className="text-red-600 text-sm mt-1">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {login.error && (
            <div role="alert" className="text-red-600 text-sm">
              {getErrorMessage(login.error)}
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full py-2 bg-primary text-white rounded-md disabled:opacity-50"
          >
            {login.isPending ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          비밀번호를 잊으셨나요?<br />
          → 관리자에게 문의하세요
        </p>
      </div>
    </div>
  );
}
```

---

## React Query Hook

### useLogin

```typescript
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { LoginRequest, LoginResponse } from './types';

function useLogin() {
  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const response = await apiClient.post<LoginResponse>('/api/auth/login', data);
      return response.data.data;
    },
    onError: (error) => {
      // 에러 처리 로직 (toast 또는 alert)
    },
  });
}
```

---

## Error Handling

### 에러 메시지 매핑

```typescript
function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    switch (status) {
      case 400:
        return '입력값을 확인해주세요';
      case 401:
        return '아이디 또는 비밀번호가 일치하지 않습니다';
      case 403:
        return '비활성화된 계정입니다. 관리자에게 문의하세요';
      case 500:
        return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요';
      default:
        return '로그인에 실패했습니다. 다시 시도해주세요';
    }
  }

  return '네트워크 연결을 확인해주세요';
}
```

---

## Middleware for Protected Routes

### JWT 검증 미들웨어

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  // 로그인 페이지는 검증 불필요
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  // 환자 페이지는 인증 불필요
  if (request.nextUrl.pathname.startsWith('/patient')) {
    return NextResponse.next();
  }

  // 토큰 검증
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // 역할 기반 접근 제어 (선택)
    const path = request.nextUrl.pathname;
    if (path.startsWith('/doctor') && decoded.role !== 'doctor') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // ... 다른 역할 체크

    return NextResponse.next();
  } catch (error) {
    // 토큰 만료 또는 유효하지 않음
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token'); // 쿠키 삭제
    return response;
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Security Considerations

### 1. 비밀번호 보안

- 클라이언트에서 비밀번호 해싱하지 않음 (HTTPS로 평문 전송)
- 서버에서 bcrypt로 검증 (rounds=10)
- 비밀번호는 절대 로그에 기록하지 않음

### 2. JWT 보안

- httpOnly 쿠키로 저장 (JavaScript 접근 불가)
- Secure 플래그 (HTTPS only)
- SameSite=Strict (CSRF 방지)
- 짧은 만료 시간 (8시간)

### 3. Rate Limiting (향후 고려)

- 동일 IP에서 로그인 시도 제한 (5회/분)
- 계정별 로그인 실패 횟수 제한 (5회 실패 시 10분 잠금)

### 4. SQL Injection 방지

- Prepared Statements 사용
- Supabase 클라이언트 자동 이스케이프

---

## Performance Optimization

### 1. 최소한의 데이터 전송

- password_hash는 응답에 포함하지 않음
- 필요한 필드만 SELECT

### 2. 빠른 리다이렉트

- 로그인 성공 시 즉시 리다이렉트
- 불필요한 렌더링 방지

---

## Accessibility

- `<form>` 태그 사용 (Enter 키 제출)
- `<label>` 태그로 입력 필드 연결
- `aria-invalid` 속성으로 에러 상태 표시
- 에러 메시지에 `role="alert"` 사용
- 자동 포커스 (ID 입력창)

---

*문서 버전: 1.0*
*최종 수정: 2025-01-29*

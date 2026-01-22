# 코드베이스 개선 계획

## 분석 요약

| 카테고리 | 발견된 이슈 | 심각도 |
|---------|-----------|--------|
| 타입 안전성 | 82+ `as any` 사용 | 높음 |
| 보안 | JWT 기본 시크릿, 권한 검증 누락 | 높음 |
| 코드 품질 | 중복 코드, 불일치 패턴 | 중간 |
| 테스트 | 2개 파일만 존재 (~3% 커버리지) | 중간 |
| 성능 | N+1 쿼리 패턴 | 낮음 |
| 개발자 경험 | 문서화 부족, 환경변수 미정리 | 낮음 |

---

## Phase 1: 긴급 수정 (Critical Fixes)

### 1.1 보안 취약점 수정

#### JWT 시크릿 기본값 제거
**파일**: `src/lib/token.ts:3`

현재:
```typescript
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-key');
```

수정:
```typescript
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}
const secret = new TextEncoder().encode(jwtSecret);
```

#### 비밀번호 초기화 권한 검증 추가
**파일**: `src/features/admin/backend/service.ts` - `resetStaffPassword()`

요청자가 admin 역할인지 검증하는 로직 추가 필요

### 1.2 깨진 기능 수정

#### Staff 서비스 birth_date 참조 제거
**파일**: `src/features/staff/backend/service.ts:138, 213`

`birth_date` 필드가 제거되었으나 여전히 참조 중:
```typescript
// 제거 필요
.select('id, name, birth_date, gender, coordinator_id')
birth_date: (patient as any).birth_date,
```

수정:
```typescript
.select('id, name, gender, coordinator_id')
// birth_date 라인 제거
```

### 1.3 중복 라우트 정리
**파일**: `src/server/hono/app.ts:32, 34`

현재:
```typescript
app.route('/api/patients', patientRoutes);
app.route('/api', patientRoutes);  // 중복
```

수정:
```typescript
app.route('/api/patients', patientRoutes);
// '/api' 라우트 제거 또는 명확한 의도 문서화
```

---

## Phase 2: 타입 안전성 개선

### 2.1 Supabase 타입 적용

#### Database 타입 활용
**영향 파일**: 모든 `backend/service.ts` 파일

현재:
```typescript
const { data, error } = await (supabase.from('patients') as any).select(...)
```

수정:
```typescript
const { data, error } = await supabase
  .from('patients')
  .select('id, name, gender, coordinator_id')
  .eq('status', 'active');
```

#### 공통 응답 타입 정의
**새 파일**: `src/types/api.ts`

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  statusCode: number;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  statusCode: number;
}
```

### 2.2 에러 코드 패턴 통일

**영향 파일**: 모든 `backend/error.ts` 파일

현재 불일치:
- Admin: `enum AdminErrorCode`
- Patient: `const PatientErrorCode = { ... } as const`
- Staff: `enum StaffErrorCode`

통일 방향: `const ... as const` 패턴 사용 (tree-shaking 유리)

---

## Phase 3: 코드 중복 제거

### 3.1 공통 서비스 추출

#### Task Completion 공통 서비스
**새 파일**: `src/server/services/task.ts`

Staff와 Nurse에서 동일한 로직 사용:
- `src/features/staff/backend/service.ts:244-299`
- `src/features/nurse/backend/service.ts:87-142`

```typescript
export async function completeTask(
  supabase: SupabaseClient<Database>,
  staffId: string,
  role: 'coordinator' | 'nurse',
  params: CompleteTaskRequest,
): Promise<TaskCompletion> {
  // 공통 로직
}
```

#### Message Creation 공통 서비스
**새 파일**: `src/server/services/message.ts`

```typescript
export async function createMessage(
  supabase: SupabaseClient<Database>,
  authorId: string,
  authorRole: 'coordinator' | 'nurse' | 'doctor',
  params: CreateMessageRequest,
): Promise<Message> {
  // 공통 로직
}
```

### 3.2 유틸리티 함수 추출

#### 날짜 관련 유틸리티
**새 파일**: `src/lib/date.ts`

```typescript
export const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function getDayNameKo(dayIndex: number): string {
  return DAY_NAMES_KO[dayIndex];
}

export function formatDateKo(date: Date | string): string {
  // 표준화된 날짜 포맷팅
}
```

---

## Phase 4: 테스트 커버리지 확대

### 4.1 우선순위별 테스트 추가

#### P0: 인증/권한 테스트
- `src/lib/token.test.ts` - JWT 생성/검증
- `src/server/middleware/auth.test.ts` - 인증 미들웨어

#### P1: 핵심 서비스 테스트
- `src/features/admin/backend/service.test.ts`
- `src/features/staff/backend/service.test.ts`
- `src/features/nurse/backend/service.test.ts`

#### P2: API 라우트 통합 테스트
- `src/features/admin/backend/route.test.ts`
- 각 엔드포인트별 요청/응답 검증

#### P3: 컴포넌트 테스트
- 폼 모달 컴포넌트 (StaffFormModal, PatientFormModal)
- 테이블 컴포넌트 (StaffTable, PatientsTable)

### 4.2 테스트 설정 개선

**파일**: `vitest.config.ts`

커버리지 제외 항목 재검토:
```typescript
coverage: {
  exclude: [
    // src/hooks/** 제거 - 테스트 필요
    // src/constants/** 제거 - 일부 비즈니스 로직 포함
  ],
}
```

---

## Phase 5: 아키텍처 개선

### 5.1 Role-Based Access Control 미들웨어

**새 파일**: `src/server/middleware/rbac.ts`

```typescript
export function requireRole(...roles: UserRole[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
```

사용:
```typescript
app.use('/api/admin/*', withAuth(), requireRole('admin'));
```

### 5.2 Zustand Store 패턴 통일

**영향**: nurse, staff 피처에 store 추가 또는 admin에서 store 제거

권장: React Query만 사용하고 Zustand는 순수 클라이언트 UI 상태에만 사용

---

## Phase 6: 성능 최적화

### 6.1 N+1 쿼리 해결

#### Admin getPatients 개선
**파일**: `src/features/admin/backend/service.ts`

현재: 환자 목록 조회 후 coordinator 이름 별도 조회

수정: Supabase 관계 조인 사용
```typescript
.select(`
  id, name, status, room_number,
  coordinator:coordinator_id(id, name)
`)
```

#### Staff getMyPatients RPC 최적화
**파일**: `src/features/staff/backend/service.ts`

현재: RPC 실패 시 4개 쿼리 실행

수정:
1. RPC 함수가 존재하도록 마이그레이션 확인
2. 또는 단일 복합 쿼리로 리팩토링

### 6.2 Query Invalidation 전략

**영향 파일**: 모든 mutation hooks

```typescript
// 현재 (너무 광범위)
queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });

// 개선 (특정 페이지만)
queryClient.invalidateQueries({
  queryKey: ['admin', 'staff', 'list'],
  exact: true
});
```

---

## Phase 7: 개발자 경험 개선

### 7.1 환경 변수 문서화

**새 파일**: `.env.example`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Authentication
JWT_SECRET=your-secure-secret-key-min-32-chars

# Optional
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### 7.2 디버그 로그 정리

**파일**: `src/app/login/actions.ts`

프로덕션에서 노출되는 console.log 제거 또는 조건부 로깅으로 변경:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}
```

### 7.3 API 문서화

**새 파일**: `docs/api.md`

각 엔드포인트의 요청/응답 스키마 문서화

---

## 실행 계획

| Phase | 작업 | 예상 파일 수 | 리스크 |
|-------|-----|------------|-------|
| 1 | 긴급 수정 | 3-4 | 낮음 |
| 2 | 타입 안전성 | 10-15 | 중간 |
| 3 | 중복 제거 | 5-7 | 중간 |
| 4 | 테스트 추가 | 8-12 | 낮음 |
| 5 | 아키텍처 개선 | 3-5 | 높음 |
| 6 | 성능 최적화 | 5-8 | 중간 |
| 7 | DX 개선 | 3-4 | 낮음 |

---

## 권장 순서

1. **Phase 1** 먼저 (보안 및 깨진 기능)
2. **Phase 7.1** (.env.example 추가)
3. **Phase 2** (타입 안전성 - 리팩토링 기반)
4. **Phase 4** (테스트 - 안전망 확보)
5. **Phase 3, 5, 6** (순차적 개선)

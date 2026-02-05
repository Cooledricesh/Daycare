# 코드베이스 개선 계획

> **최종 업데이트**: 2025-01-23
>
> **현재 상태**: PRD 핵심 기능 구현 완료, 후순위 리팩토링 항목 남음

---

## 진행 현황 요약

| Phase | 항목 | 상태 | 비고 |
|-------|------|------|------|
| **Phase 0** | PRD 미구현 페이지 | ✅ **완료** | `/doctor/tasks`, `/doctor/history/[id]`, `/staff/messages` |
| **Phase 1** | 긴급 수정 | ✅ **완료** | JWT 시크릿, birth_date 제거, 중복라우트 정리 |
| **Phase 5** | 아키텍처 개선 | ✅ **완료** | RBAC 미들웨어 구현됨 |
| **Phase 7** | DX 개선 | ✅ **완료** | .env.example 존재 |
| **Phase 2** | 타입 안전성 | 🔶 후순위 | 82+ `as any` 제거 필요 |
| **Phase 3** | 코드 중복 제거 | 🔶 후순위 | task/message 공통 서비스 |
| **Phase 4** | 테스트 커버리지 | 🔶 후순위 | E2E 테스트 8개 추가됨 |
| **Phase 6** | 성능 최적화 | 🔶 후순위 | N+1 쿼리 해결 |

---

## ✅ 완료된 작업

### Phase 0: PRD 핵심 페이지 구현

| 페이지 | 경로 | 기능 |
|--------|------|------|
| 처리 필요 항목 | `/doctor/tasks` | 의사 지시사항 일괄 조회/관리, 필터링 |
| 환자 히스토리 | `/doctor/history/[id]` | 환자별 최근 진찰/전달사항 기록 조회 |
| 전달사항 작성 | `/staff/messages` | 코디네이터→의사 전달사항 작성/조회 |

**생성된 파일**:
- `src/features/doctor/` (backend, hooks, components)
- `src/app/doctor/tasks/page.tsx`
- `src/app/doctor/history/[id]/page.tsx`
- `src/app/staff/messages/page.tsx`

### Phase 1: 긴급 수정

- ✅ JWT 시크릿 기본값 제거 (환경변수 필수)
- ✅ `birth_date` 참조 제거 (DB에서 삭제된 필드)
- ✅ 중복 라우트 정리
- ✅ 비밀번호 초기화 권한 검증

### Phase 5: RBAC 미들웨어

- ✅ `src/server/middleware/rbac.ts` - 역할 기반 접근 제어
- ✅ API 라우트에 RBAC 적용 (`/api/admin/*`, `/api/doctor/*`)
- ✅ middleware.ts에서 admin 전역 접근 허용

### Phase 7: 개발자 경험

- ✅ `.env.example` 파일 생성
- ✅ E2E 테스트 가이드 (`docs/e2e-testing-guide.md`)
- ✅ 문서 구조 정리

### E2E 테스트 추가

| 테스트 파일 | 테스트 수 | 내용 |
|------------|----------|------|
| `home.spec.ts` | 2 | 홈 페이지 |
| `login.spec.ts` | 3 | 로그인 기능 |
| `patient-checkin.spec.ts` | 2 | 환자 체크인 |
| `protected-routes.spec.ts` | 2 | 보호 라우트 |
| `room-mapping-sync.spec.ts` | 3 | 호실 매핑 |
| `doctor-tasks.spec.ts` | 3 | 의사 처리 항목 |
| `doctor-history.spec.ts` | 3 | 환자 히스토리 |
| `staff-messages.spec.ts` | 3 | 전달사항 |

---

## 🔶 후순위 작업

### Phase 2: 타입 안전성 개선

**현황**: 82+ `as any` 사용

**작업 내용**:
1. Supabase Database 타입 적용
2. API 응답 타입 통일 (`src/types/api.ts`)
3. 에러 코드 패턴 통일 (`const ... as const`)

**영향 파일**: 모든 `backend/service.ts` 파일

```typescript
// Before
const { data } = await (supabase.from('patients') as any).select(...)

// After
const { data } = await supabase.from('patients').select('id, name, gender')
```

### Phase 3: 코드 중복 제거

**작업 내용**:
1. Task completion 공통 서비스 추출 (`src/server/services/task.ts`)
2. Message creation 공통 서비스 (`src/server/services/message.ts`)
3. 날짜 유틸리티 통합 (`src/lib/date.ts`)

**중복 위치**:
- `staff/backend/service.ts` ↔ `nurse/backend/service.ts` (task completion)
- 여러 곳에서 동일한 날짜 포맷팅 로직

### Phase 4: 테스트 커버리지 확대

**우선순위**:
1. P0: 인증/권한 테스트 (`token.test.ts`, `auth.test.ts`)
2. P1: 핵심 서비스 테스트 (`admin/service.test.ts` 등)
3. P2: API 라우트 통합 테스트
4. P3: 컴포넌트 테스트

### Phase 6: 성능 최적화

**N+1 쿼리 해결**:
- Admin `getPatients`: coordinator 조인 최적화
- Staff `getMyPatients`: RPC 또는 복합 쿼리

**Query Invalidation 개선**:
```typescript
// Before
queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });

// After (정확한 키 사용)
queryClient.invalidateQueries({ queryKey: ['admin', 'staff', 'list'], exact: true });
```

---

## 추가 구현 필요 (선택)

### Google Sheets 환자 동기화

**문서**: `docs/specs/google-sheets-sync.md`

**현황**:
- ✅ DB 스키마 완료 (`room_coordinator_mapping`, `sync_logs`)
- ✅ 서비스 기본 구조 (`src/server/services/patient-sync.ts`)
- ✅ 관리자 UI 기본 (`/admin/sync`, `/admin/settings/room-mapping`)
- ⏳ Google Sheets API 연동 미완료

**남은 작업**:
1. Google Cloud 서비스 계정 설정
2. Google Sheets API 연동
3. 자동 스케줄러 (cron)

---

## 권장 진행 순서

1. **Phase 4** - 테스트 추가 (안전망 확보)
2. **Phase 2** - 타입 안전성 (리팩토링 기반)
3. **Phase 3** - 코드 중복 제거
4. **Phase 6** - 성능 최적화
5. Google Sheets 연동 (필요시)

---

## 관련 문서

- PRD: `docs/prd.md`
- Database: `docs/database.md`
- User Flow: `docs/userflow.md`
- E2E 테스트: `docs/e2e-testing-guide.md`
- Google Sheets Sync: `docs/specs/google-sheets-sync.md`

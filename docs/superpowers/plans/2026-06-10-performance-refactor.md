# 성능 리팩토링 계획 (2026-06-10)

## 배경 / 증상

기능을 하나씩 추가하면서 화면 진입·갱신이 점점 느려지는 증상. 코드베이스 전수 점검 결과,
최근 추가된 기능들(연속출석 스트릭, 하이라이트, 결석위험 등)이 공통적으로
**"요청 시점에 전체 활성 환자 × N일 윈도우 데이터를 매번 새로 계산"**하는 구조여서,
데이터 누적량과 기능 수에 비례해 선형으로 느려지는 것이 근본 원인.

## 검증된 병목 (코드 직접 확인 완료)

### P0 — 스트릭 계산 경로

1. **`getStreaksMap`이 요청마다 60일×4테이블 풀스캔**
   - `src/features/shared/backend/streak.ts:162-183`
   - attendances / consultations / scheduled_attendances (60일 범위) + scheduled_patterns(전체) + holidays
   - 환자 ~275명 기준 약 15,000행 → 페이지 순회 포함 **요청당 ~17회 DB 왕복**
2. **`fetchAllPaginated`가 페이지를 순차(직렬) 순회**
   - `src/lib/supabase-pagination.ts:22-28` — `for` 루프 안 `await`
   - scheduled_attendances 60일 ≈ 9,000행 = **10번 직렬 왕복** → 이 함수 하나가 0.5~1초
3. **출석보드가 30초 폴링마다 스트릭 전체 재계산**
   - `src/features/attendance-board/backend/service.ts:74` (getAttendanceBoard 내 getStreaksMap 호출)
   - `src/features/attendance-board/constants/board-config.ts:6` (REFETCH_INTERVAL 30초)
   - 보드를 켜두기만 해도 30초마다 위 비용 전액 재지불
4. **4개 직역 대시보드의 `/api/shared/attendance-board/streaks`도 동일 계산, 서버 캐시 없음**
   - `getStreaksForActivePatients` (`attendance-board/backend/service.ts:214`)
   - 렌더 사이트 (exact):
     - `src/features/doctor/components/PatientListPanel.tsx:50`
     - `src/features/nurse/components/NursePatientListPanel.tsx:50`
     - `src/features/staff/components/StaffPatientListPanel.tsx:87`
     - `src/features/admin/components/AdminPatientListPanel.tsx:50`

### P1 — 요청당 중복/낭비 쿼리

5. **의사 대기목록 consultations 2중 조회 + 불필요한 직렬 단계**
   - `src/features/doctor/backend/service.ts:556-560` 단계2에서 이미 `patient_id, has_task, task_completions(is_completed)` 조회
   - `:612-617` 단계3에서 `has_task=true`만 재조회, `:628-632` 단계4에서 task_completions 재조회
   - 단계2 select에 `id, task_target` 추가하면 단계3 consultations 쿼리와 단계4 전체 제거 가능
   - 의사 대시보드는 30초 폴링(`src/features/doctor/hooks/useWaitingPatients.ts:27`)이라 체감 영향 큼
6. **하이라이트 14일×3테이블 페이지 순회**
   - `src/features/highlights/backend/service.ts:55-80`
   - 대시보드 진입마다 실행 (클라이언트 staleTime 10분)
7. **admin getStatsSummary가 이전 비교기간까지 한 쿼리로 로드 후 메모리 필터**
   - `src/features/admin/backend/service.ts` getStatsSummary (daily_stats `prevStartDate~endDate` 로드 후 JS filter)
8. **결석위험 오버뷰: 기간(90~180일) 페이지 순회 + 환자별 O(365) 루프**
   - `src/features/absence-risk/backend/service.ts:152-265`
9. **월간 리포트: 15개 계산 함수가 같은 테이블을 각자 재조회**
   - `src/features/monthly-report/backend/service.ts:118-180` (온디맨드 화면이라 우선순위 낮음)

### P2 — 클라이언트 렌더링/캐시

10. **목록 행·뱃지 memo 부재**: 4개 `*PatientListPanel`(특히 `StaffPatientListPanel.tsx` 531줄), `src/features/shared/components/StreakBadge.tsx` — 검색/필터 입력마다 전체 행 재렌더
11. **광범위 invalidation**: `src/features/admin/hooks/useDashboard.ts:109-111, 123-124, 151-153, 175` — 메시지 1건 변경에 `patientAll`/`patientHistoryAll` prefix 전체 무효화
12. **월별 캘린더 fan-out**: `src/features/shared/hooks/useMultiMonthAttendanceCalendar.ts:23-39` — 3~12개월 = 3~12개 개별 API 호출
13. **staleTime 불일치**: `useWaitingPatients` staleTime 미설정(0) + 30초 폴링 중복

### 인덱스 보강 (마이그레이션)

- `scheduled_patterns (is_active, day_of_week)` — ensureScheduleGenerated의 요일 매칭
- `room_coordinator_assignments (is_active, role)` — 보드/직원 화면 매 요청 조회
- 기존 복합 인덱스(`20260310000002_add_composite_indexes.sql`)는 양호

---

## 실행 계획

### Phase A — 즉시 수정 (위험 낮음, 효과 즉시)

| # | 작업 | 파일 | 예상 효과 |
|---|------|------|----------|
| A1 | `fetchAllPaginated` 병렬화: 첫 페이지를 `count: 'exact'`로 요청 → 총 페이지 수 산출 → 나머지 페이지 `Promise.all` 병렬 발사 | `src/lib/supabase-pagination.ts` (+ 호출부 시그니처 영향 검토, 기존 테스트 갱신) | 직렬 10왕복 → 1+병렬1왕복. 스트릭/하이라이트/결석위험 전부 자동 개선 |
| A2 | 의사 대기목록 중복 쿼리 제거: 단계2 consultations select에 `id, task_target` 추가, 단계3의 consultations 재조회·단계4 task_completions 재조회 삭제, scheduled_attendances만 단계3에 유지 | `src/features/doctor/backend/service.ts:544-649` | 요청당 쿼리 2개·직렬 1단계 제거 × 30초 폴링 |
| A3 | getStatsSummary 기간 분리: 현재기간/비교기간을 별도 쿼리로 `Promise.all`, 메모리 필터 제거 | `src/features/admin/backend/service.ts` | 통계 화면 100~200ms |
| A4 | 인덱스 마이그레이션 추가 (위 2건, idempotent) | `supabase/migrations/00XX_add_perf_indexes.sql` | 점진적 |
| A5 | `useWaitingPatients`에 staleTime 부여(폴링 간격과 정합), 폴링 유지 여부 명시 | `src/features/doctor/hooks/useWaitingPatients.ts` | 중복 refetch 제거 |

### Phase B — 스트릭 계산 캐싱 (핵심, 가장 큰 체감 개선)

전략: **계산 결과를 서버측 캐시 테이블에 저장하고 TTL + 이벤트 무효화로 재사용.**
프론트 스키마 변경 없음 — `getAttendanceBoard`와 `getStreaksForActivePatients` 둘 다 캐시를 읽으므로
보드 30초 폴링과 4개 대시보드가 전부 공짜가 됨.

| # | 작업 | 상세 |
|---|------|------|
| B1 | `streaks_cache` 테이블 마이그레이션 | `(cache_date date PK, payload jsonb, computed_at timestamptz, updated_at)` RLS 비활성 |
| B2 | `getStreaksMapCached(supabase, date, patients)` 래퍼 | 캐시 히트(TTL 5분) 시 payload 반환, 미스 시 기존 `getStreaksMap` 실행 후 upsert. 위치: `src/features/shared/backend/streak.ts` |
| B3 | 호출부 교체 | `attendance-board/backend/service.ts:74, 230` 두 곳 |
| B4 | 이벤트 무효화(선택) | 출석 체크인(`patient` feature service)·진찰 생성 시 당일 캐시 row delete → 다음 요청에서 재계산. 5분 TTL만으로도 충분하면 생략 |
| B5 | 하이라이트도 동일 패턴 적용(선택) | `computeTodayHighlights` 결과를 같은 캐시 테이블(또는 컬럼)에 저장. 우선 B1~B3 효과 측정 후 결정 |

대안(차후): Postgres RPC 함수로 스트릭을 DB 안에서 계산해 행 전송 자체를 제거.
효과는 더 크지만 스트릭 규칙(자동 휴원 감지, 패턴 매칭, 등록일 컷)을 SQL로 이식해야 하므로
B안 효과가 부족할 때만 진행.

### Phase C — 클라이언트 렌더링/캐시 정리

| # | 작업 | 파일 |
|---|------|------|
| C1 | 환자 행 컴포넌트 추출 + `React.memo`, `StreakBadge`에 `memo` | 4개 `*PatientListPanel`, `src/features/shared/components/StreakBadge.tsx` |
| C2 | admin mutation invalidation 정밀화: 변경된 환자 키만 무효화 (`adminKeys.dashboard.patient(id)` 등) | `src/features/admin/hooks/useDashboard.ts` |
| C3 | 월별 캘린더 범위 단일 엔드포인트: `?from=YYYY-MM&to=YYYY-MM` 백엔드 추가 후 `useQueries` fan-out 제거. **주의: 기존 월별 query key를 공유하지 말고 새 key 정의** (shape 불일치 금지 규칙) | `src/features/shared/hooks/useMultiMonthAttendanceCalendar.ts` + 해당 backend |
| C4 | staleTime 정책 표준화: 화면별 정책을 상수 파일로 모으고 주석으로 근거 기록 | 각 feature hooks |

### Phase D — 측정 및 가드레일

| # | 작업 |
|---|------|
| D1 | Hono 미들웨어에 라우트별 소요시간 로깅(이미 logger 주입됨) — 전/후 수치 비교 근거 확보. Phase A 시작 전에 먼저 넣어 baseline 측정 |
| D2 | 주요 서비스 함수 단위 테스트 보강 (특히 A1 페이지네이션 병렬화, A2 의사 대기목록 — 기존 동작 동일성 검증) |
| D3 | 완료 후 `docs/improvement-plan.md`의 Phase 6 항목 상태 갱신 (이 계획이 Phase 6을 흡수·대체) |

## 진행 순서

```
D1 (baseline 측정 로깅)
 → Phase A (A1~A5, 각각 독립 커밋)
 → Phase B (B1~B3 → 측정 → 필요시 B4·B5)
 → Phase C (C1~C4)
 → D2·D3
```

## 비범위 (이번에 하지 않음)

- 월간 리포트 내부 중복 쿼리 정리(#9) — 온디맨드 화면, 별도 건으로
- 결석위험 materialized view 전환(#8) — A1 병렬화 효과 측정 후 판단
- WebSocket/SSE 전환 — 폴링 비용이 Phase B 이후 충분히 낮아지면 불필요
- Phase 2(as any 제거)·Phase 3(중복 제거) 잔여 항목 — 기존 계획 문서 유지

## 위험 요소

- A1: `fetchAllPaginated` 시그니처 변경 시 호출부 6곳+ 영향 — 기존 인터페이스 유지하고 내부만 병렬화할 것. count 쿼리가 불가능한 빌더 대비 fallback(기존 순차 로직) 유지
- B: 캐시 staleness — 출석 체크 직후 스트릭 뱃지가 최대 5분 늦게 반영될 수 있음. 사용자 확인 필요 시 B4(이벤트 무효화)로 해소
- C2: invalidation 누락으로 화면 갱신 안 되는 회귀 — E2E로 메시지 CRUD 후 목록 갱신 확인

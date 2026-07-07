# 핸드오프 문서 (HANDOFF)

> **목적**: 시간이 지난 뒤 새 세션에서 작업을 시작할 때, 이 문서 하나로 레포 전체 맥락을 복원한다.
> **유지 규칙**: 구조 변경·큰 기능 추가·운영 절차 변경이 있는 작업을 끝낼 때마다 이 문서를 갱신한다.
> 최종 갱신: 2026-07-02

## 1. 이 프로젝트가 뭔가

정신과 **낮병원 환자 출석/진찰 관리 시스템**. 실서비스 운영 중 (실제 환자 데이터 ~275명).
사용자(레포 주인)는 정신과 의사이며 전문 개발자가 아님 — 설명은 한국어로, 결정은 명확한 선택지로.

- 4대 핵심 지표: 출석률 / 진찰 참석률 / 처방 이행률 / 연속출석 스트릭
- 역할 5종: 환자(태블릿 출석체크, 인증 없음) / 코디(사회복지사) / 간호사 / 의사 / 관리자
- 도메인 용어 주의: 의사 워크플로우에서는 "진찰 체크"가 맞는 용어 ("참석" 아님)
- 진찰 운영 종료는 **KST 12:00 (정오)** — 시간 민감 판정(하이라이트 등)은 이 컷오프 기준

## 2. 인프라 / 배포

| 항목 | 값 |
|---|---|
| 저장소 | github.com/Cooledricesh/Daycare (`main` 브랜치) |
| 배포 | Vercel — `main` push 시 자동 배포. **push는 반드시 사용자 확인 후** (실서비스) |
| DB | Supabase 프로젝트 `hgkhcbdixubimbraigen` (Daycare, ap-south-1) — 운영 DB 직결 주의 |
| 연동 | Carescheduler (주사제 시스템, `careschedulerp.vercel.app`, Supabase `xlhtmakvxbdjnpvtzdqh`) — BFF로 주사 이력 조회 |
| 크론 | vercel.json: 월간리포트(매월 1일), 공휴일 동기화(매월 1일) — **Hobby 플랜이라 2개가 한도**. 진찰 알림은 **Supabase pg_cron**(jobname `noon-attendance-report`, UTC 07:00 평일 = KST 16:00)이 pg_net으로 엔드포인트 호출. 환자 동기화는 Google Sheets 08:15 KST |
| 슬랙 알림 | 봇 `@alimi`(`SLACK_BOT_TOKEN` 1개) + 채널 상수 `src/constants/slack-channels.ts`. ① 평일 16:00 당일 채널 기록을 출석/진찰 DB에 반영한 뒤 미출석/미진찰 명단(실명) + 월간 리포트 요약 → `#마루-진찰`(채널 ID `C0B9LCED676`) ② 매일 08:30 회원("환자"의 원내 호칭) 생일 알림 → `#마루` (마루 = 대동병원 낮병원 이름). 상세: `docs/superpowers/plans/2026-06-10-slack-noon-report.md`. 정기 알림은 앱 직송 — 헤르메스 에이전트 경유 금지(장애 시 누락). CRON_SECRET은 2026-06-11 rotate (Vercel env·.env.local·cron.job 세 곳 동일값). **새 알림 추가는 `docs/cron-jobs-guide.md` 참고** (compose 순수함수 + cron 라우트 복사 + 채널 상수 + pg_cron 잡 1줄, 환경변수 불필요. 배포→pg_cron 등록 순서 주의) |

### 마이그레이션 적용 방법 (중요)

- SQL 파일은 `supabase/migrations/`에 작성 (idempotent, updated_at 트리거는 공용 `update_updated_at()` 재사용, RLS 비활성)
- **supabase CLI 직결(`db push`, `migration list --linked`)은 이 네트워크에서 IPv6 미지원으로 실패함**
- 실제 적용은 **Supabase MCP의 `apply_migration`** 사용 (project_id: `hgkhcbdixubimbraigen`). 적용 전 execute_sql로 전제조건 확인, 적용 후 검증 쿼리 실행
- MCP로 적용 시 version이 자동 타임스탬프라 로컬 파일명 버전과 불일치함 (정상)

## 3. 실제 코드 구조 (CLAUDE.md와 다른 부분 주의)

CLAUDE.md의 디렉토리 설명 중 `src/backend/*`는 **낡은 정보**다. 실제 백엔드 레이어는 `src/server/*`:

```
src/app/api/[[...hono]]/route.ts   → handle(createHonoApp()), runtime=nodejs
src/server/hono/app.ts             → Hono 싱글턴. 미들웨어 순서: errorBoundary → withAppContext → withRequestTiming → withSupabase → (라우트별) withAuth+requireRole
src/server/middleware/*            → error, context, timing, supabase, auth, rbac
src/server/services/*              → 공유 서비스 (task, message, schedule, patient-sync, patient-detail)
src/server/http/response.ts        → success/failure/respond 패턴
src/features/[feature]/backend/    → route.ts(Hono), service.ts(비즈니스), schema.ts(zod), error.ts
src/features/[feature]/hooks/      → React Query 훅 + query-keys.ts
src/features/shared/               → 직역 공통 (스트릭, 캘린더, StreakBadge 등)
```

- 인증: 커스텀 JWT (Supabase Auth 아님). `/api/shared/*`는 4개 직역 모두 접근 가능
- 프론트는 전부 Client Component + React Query. 서버 상태는 React Query로만

## 4. 성능 관련 불변식 (2026-06-10 리팩토링 결과 — 깨뜨리지 말 것)

상세 진단·계획: `docs/superpowers/plans/2026-06-10-performance-refactor.md`

1. **Supabase PostgREST는 서버측 1000행 캡** — 대량 조회는 반드시 `fetchAllPaginated` (`src/lib/supabase-pagination.ts`). 이 함수는 5페이지 wave 병렬이며, 안정적 페이지 경계를 위해 쿼리에 unique 컬럼 order 필수
2. **스트릭은 `getStreaksMapCached`로만 호출** (`src/features/shared/backend/streak.ts`) — `streaks_cache` 테이블(날짜별 jsonb)에 **5분 TTL** 캐싱. 사용자가 "출석 직후 최대 5분 표시 지연" 승인함. 캐시 오류 시 원본 계산 fallback. 원본 `getStreaksMap`을 핫패스에서 직접 부르면 60일×4테이블 풀스캔이 되살아남
3. **요청 시점에 "전체 환자 × N일 윈도우"를 새로 계산하는 기능을 추가하지 말 것** — 이게 과거 점진적 슬로다운의 근본 원인. 새 대시보드성 기능은 (a) 배치 엔드포인트 1개, (b) 서버 캐시, (c) 좁은 윈도우 중 하나를 갖출 것
4. **폴링 훅은 staleTime = refetchInterval** (의사 대기목록·출석보드 30초)
5. **React Query 같은 query key 공유 시 queryFn return shape 정확히 일치** — shape 다르면 새 key. 다중 월 캘린더는 `attendanceCalendarRange` key + `/attendance-calendar/range?from&to` 단일 엔드포인트 사용 (월별 fan-out 금지)
6. **API 소요시간은 `[timing]` 로그로 측정** (`src/server/middleware/timing.ts`, 1초↑ warn) — Vercel 함수 로그에서 확인. 성능 의심 시 추측 말고 이 로그부터
7. 환자 목록 행은 memo된 행 컴포넌트 — 행에 내려주는 props는 원시값/안정 참조 유지 (인라인 객체/함수 넘기면 memo 무력화)
8. `daily_stats.registered_count`는 배치 재계산 시 기존 값 보존 (스냅샷 패턴)

## 5. 작업 워크플로우 컨벤션

- 계획 문서: `docs/superpowers/plans/YYYY-MM-DD-제목.md` → `implementer` 에이전트로 구현 → **에이전트 결과물은 반드시 직접 diff 검증 후 커밋** (외부/에이전트 분석은 코드 대비 검증이 원칙)
- 커밋: Conventional Commits, 설명은 한국어, 항목별 분리 커밋. **push는 사용자 확인 후** (Vercel 자동 배포 때문)
- 품질 게이트 (전부 통과 후 커밋): `npx tsc --noEmit` / `npx eslint src --quiet` / `npx vitest run` / `npm run build`
- 계획에 렌더/수정 지점은 모호한 표현 대신 **정확한 파일 경로 전부 나열** (grep으로 먼저 조사)
- 캘린더 UI는 shadcn Calendar 대신 date-fns 커스텀 그리드
- 새 유틸 만들기 전 `@/lib/` 먼저 검색

## 6. 현재 상태 / 백로그 (2026-06-10 기준)

**완료**: 성능 리팩토링 전체 (계획 문서의 Phase A~D, 커밋 13개 push·배포·마이그레이션 적용 완료, 사용자가 출석보드 체감 속도 직접 확인함). improvement-plan.md의 Phase 1/4/5/6/7/8/9 완료.

**완료 (2026-06-11)**: 슬랙 정오 출석 리포트 + 월간 리포트 통보 (pg_cron 트리거, 배포 완료. 첫 자동 실행 2026-06-11 12:05 KST — 실행 이력: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`)

**구현 완료·적용 대기 (2026-07-02)**: 휴진일(진찰 없는 날) 관리. 주치의 휴가처럼 출석은 하되 진찰만 없는 날을 관리자가 지정 → 그날은 **출석은 정상 집계, 모든 진찰 지표에서만 제외**(공휴일과 별개 개념). 계획: `docs/superpowers/plans/2026-07-02-clinic-closure.md` (Codex 2회 리뷰 반영). 관리 UI: 관리자 통계 페이지의 공휴일 관리 옆 "휴진일 관리". 진찰 지표 제외 반영 지점: 기간 통계 `aggregateStats`(+`average_consultation_rate` 분모 분리 `consultationRateDays`), 일별 통계 플래그 `is_clinic_closure`, 월간 리포트 진찰 카드·참석률·코디별 참석률, admin 코디 워크로드 진찰 전환율·일평균, 오늘 하이라이트 `examMissed`, 슬랙 정오 리포트(미진찰 생략·미출석 유지), 요일별 통계·진찰 추이 차트·상세표. **출석 지표는 불변.** ⚠️ **적용 대기 마이그레이션**: `supabase/migrations/20260702000001_create_clinic_closures_table.sql` (Supabase MCP `apply_migration`로 적용 필요). 월간 리포트는 저장형이라 휴진일 변경 시 해당 월 리포트 재생성해야 반영됨.

**남은 백로그** (우선순위 순):
1. 헤르메스 에이전트용 읽기 전용 리포트 API (`/api/external/reports/*`, API key 인증 — carescheduler 패턴 재사용). 슬랙에서 온디맨드 질의용
2. Supabase 타입 자동 생성(`supabase gen types`) 전환 → Phase 2 `as any` 제거(82+곳)와 연계
3. Phase 3 잔여 — 코드 중복 제거
4. 성능 비범위 항목 (필요해지면): 결석위험 사전계산, 월간 리포트 내부 중복 쿼리 정리, 하이라이트 캐싱(B5), 스트릭 Postgres RPC 이전
5. 키보드 단축키 P2 부채 2건

## 7. 주요 문서 맵

| 문서 | 내용 |
|---|---|
| `docs/prd.md` | 전체 요구사항·와이어프레임 |
| `docs/database.md` | 테이블 정의·관계 |
| `docs/improvement-plan.md` | 리팩토링 페이즈별 상태 |
| `docs/superpowers/plans/` | 날짜별 구현 계획 (최신순 확인) |
| `docs/cron-jobs-guide.md` | **크론잡(정기 슬랙 알림) 추가 표준 절차** |
| `docs/e2e-testing-guide.md` | Playwright E2E (baseURL localhost:3000) |

# 슬랙 정오 출석 리포트 (2026-06-10)

## 목표

평일 정오(KST 12:05)에 병원 공용 슬랙 채널로 **그날 미출석/미진찰 환자 명단(실명)**을 자동 전송.
월간 리포트 생성 시에도 요약을 슬랙으로 통보.

사용자 결정사항:
- 환자 정보 노출 수준: **실명** (채널 멤버 전원 병원 직원)
- 정기 알림은 앱이 직접 Slack Webhook으로 전송 (헤르메스 에이전트 경유 금지 — 에이전트 장애 시 알림 누락 방지)
- 헤르메스용 읽기 전용 API는 별도 후속 작업

## 구현 항목

### 1. Slack 클라이언트 — `src/server/integrations/slack/client.ts`

- carescheduler 클라이언트와 같은 구조
- `sendSlackMessage(webhookUrl: string, payload: { text: string; blocks?: unknown[] })` — fetch POST
- 실패 시 throw하지 않고 `{ ok: boolean; error?: string }` 반환 (에러 리턴 선호 원칙)

### 2. 정오 리포트 조립 — `src/server/services/noon-report.ts`

- 데이터는 기존 `getAttendanceBoard` (attendance-board/backend/service.ts) **재사용** — 이미 환자별
  status(`absent` / `attended` / `attended_consulted` / `not_scheduled`)와 집계가 다 있고,
  ensureScheduleGenerated·streaks_cache도 내장
- `composeNoonReportMessage(board: AttendanceBoardResponse, dateLabel: string)` — **순수 함수** (테스트 대상):
  - 미출석 = status `absent`, 미진찰 = status `attended`
  - 형식:
    ```
    🏥 낮병원 정오 현황 — 6월 10일 (수)
    출석 32/37 · 진찰 28/32

    ❌ 미출석 (5명)
    김철수(3012), 이영희(3013), …

    🩺 출석 후 미진찰 (4명)
    박민수(3021), …
    ```
  - 이름은 `display_name || name`, 괄호 안 호실(room_number, 없으면 생략)
  - 미출석/미진찰 0명이면 해당 섹션 생략, 둘 다 0이면 "전원 출석·진찰 완료 🎉" 한 줄

### 3. 크론 라우트 — `src/app/api/internal/cron/noon-attendance-report/route.ts`

- holidays-sync 패턴 그대로: `POST`, `CRON_SECRET` Bearer 검증, `runtime='nodejs'`
- `SLACK_WEBHOOK_URL` 미설정 시 503 (HOLIDAY_API_KEY 패턴)
- 스킵 조건 (200 + `{ status: 'skipped', reason }` 반환):
  - KST 기준 주말
  - holidays 테이블에 오늘 날짜 존재 (`getHolidayDatesMap` 재사용)
- 날짜는 KST 기준 오늘 (`getTodayString` 등 기존 유틸 확인 후 재사용)

### 4. 스케줄 — vercel.json

- `{ "path": "/api/internal/cron/noon-attendance-report", "schedule": "5 3 * * 1-5" }` (UTC 03:05 = KST 12:05)
- ⚠️ Vercel Hobby 플랜은 크론 2개 제한 (이미 2개 사용 중) — Pro가 아니면 배포 실패 가능.
  Hobby일 경우 대안: GitHub Actions schedule로 `curl -X POST -H "Authorization: Bearer $CRON_SECRET"` 호출

### 5. 월간 리포트 슬랙 통보

- 기존 `/api/internal/cron/monthly-report-generate` 라우트 끝에 추가:
  생성 성공 시 핵심 수치(총 출석일, 출석률 등 리포트에 이미 있는 값) 요약 + 앱 링크 전송
- `SLACK_WEBHOOK_URL` 미설정이면 조용히 스킵 (리포트 생성 자체는 성공 처리 유지)

### 6. 테스트

- `composeNoonReportMessage` 단위 테스트: 정상 케이스 / 미출석 0 / 전원 완료 / room_number null

## 환경변수

- `SLACK_WEBHOOK_URL` — Vercel(Production) + `.env.local`. config/index.ts envSchema에는 **추가하지 않음**
  (필수화하면 미설정 시 전체 백엔드가 죽음 — HOLIDAY_API_KEY처럼 라우트에서 직접 읽기)

## 비범위 (후속)

- 헤르메스용 읽기 전용 리포트 API (`/api/external/reports/*`)
- `[timing]` 슬로우 요청 슬랙 통보
- 결석위험(연속결석) 주간 리포트

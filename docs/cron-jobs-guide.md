# 크론잡(정기 알림) 추가 가이드

> **목적**: 새로운 정기 슬랙 알림(또는 배치 작업)을 추가하는 표준 절차.
> 새 알림을 만들 때 이 문서의 레시피를 그대로 따르면 환경변수를 건드릴 필요가 없다.
> 최종 갱신: 2026-06-19

## 0. 전체 그림 (현재 구조)

```
Supabase pg_cron (스케줄러)
  └─ pg_net.http_post ──Bearer CRON_SECRET──▶ Vercel 앱
                                               /api/internal/cron/<이름>
                                                 ├─ CRON_SECRET 인증
                                                 ├─ Supabase에서 데이터 조회
                                                 ├─ compose 순수함수로 메시지 조립
                                                 └─ postSlackMessage(botToken, 채널, text)
                                                      └─▶ Slack (@alimi 봇) → 채널
```

- **스케줄링은 Supabase pg_cron**이 담당한다 (Vercel Hobby 플랜은 크론 2개 제한이라 vercel.json은 월간리포트·공휴일동기화로 이미 꽉 참).
- **실제 데이터 가공·전송은 Vercel 앱**이 한다. pg_cron은 그냥 HTTP로 엔드포인트를 때릴 뿐.
- **슬랙 전송은 봇 토큰 1개**(`SLACK_BOT_TOKEN`, 봇 이름 `@alimi`)로 모든 채널에 보낸다. 채널은 코드 상수로 관리.

## 1. 이미 존재하는 재사용 부품 (새로 만들지 말 것)

| 부품 | 위치 | 역할 |
|---|---|---|
| `postSlackMessage(botToken, channel, text)` | `src/server/integrations/slack/client.ts` | 슬랙 전송. 실패해도 throw 안 하고 `{ ok, error }` 반환 |
| `SLACK_CHANNELS` | `src/constants/slack-channels.ts` | 채널 상수 (`마루-진찰`은 채널 ID `C0B9LCED676`, `#마루` …) |
| `getTodayString()` / `getNowKST()` | `src/lib/date.ts` | KST 기준 오늘 날짜 / 현재 시각 Date |
| `getHolidayDatesMap()`, `isWeekend()` | `src/lib/business-days.ts` | 공휴일/주말 판정 |
| `createServiceClient()` + `getAppConfig()` | `src/server/supabase/client.ts`, `src/server/config` | service-role Supabase 클라이언트 |

기존 라우트 2개가 복사용 템플릿이다:
- `src/app/api/internal/cron/noon-attendance-report/route.ts` — 주말/공휴일 스킵 + 출석 데이터 사용
- `src/app/api/internal/cron/birthday-report/route.ts` — 매일 실행 + 환자 데이터 필터링

## 2. 추가 절차 (4단계)

### Step 1. 메시지 조립 순수함수 + 테스트

`src/server/services/<이름>-report.ts` 생성. **순수 함수**여야 한다 (DB 접근·전송 없이 데이터 → 문자열만). 이렇게 분리해야 단위 테스트가 쉽다.

```ts
// src/server/services/weekly-absence-report.ts
export type AbsenceRow = { name: string; display_name: string | null; room_number: string | null; absent_days: number };

function formatPatientLabel(p: { name: string; display_name: string | null; room_number: string | null }): string {
  const name = p.display_name || p.name;
  return p.room_number ? `${name}(${p.room_number})` : name;
}

/** 순수 함수 — 사이드이펙트 없음 */
export function composeWeeklyAbsenceMessage(rows: AbsenceRow[], dateLabel: string): string {
  if (rows.length === 0) return '';
  const header = `📉 ${dateLabel} 결석위험 주간 리포트`;
  const body = rows.map((r) => `${formatPatientLabel(r)} — 최근 ${r.absent_days}일 결석`).join('\n');
  return [header, body].join('\n');
}
```

같은 폴더에 `<이름>-report.test.ts`를 만들어 vitest로 케이스 4개 정도 (정상 / 빈 목록 / 단수·복수 / null 필드). `noon-report.test.ts`·`birthday-report.test.ts` 참고.

### Step 2. 크론 라우트 복사

`src/app/api/internal/cron/<이름>/route.ts` 생성. 기존 라우트를 복사하고 데이터 쿼리 + compose 부분만 교체한다. **반드시 유지할 골격**:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/server/config';
import { createServiceClient } from '@/server/supabase/client';
import { getTodayString, getNowKST } from '@/lib/date';
import { postSlackMessage } from '@/server/integrations/slack/client';
import { SLACK_CHANNELS } from '@/constants/slack-channels';
import { composeWeeklyAbsenceMessage } from '@/server/services/weekly-absence-report';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // (1) CRON_SECRET 인증 — 모든 크론 라우트 공통, 그대로 복사
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  // (2) 봇 토큰 확인
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: 'SLACK_BOT_TOKEN 미설정' }, { status: 503 });

  // (3) Supabase 클라이언트
  const config = getAppConfig();
  const supabase = createServiceClient({ url: config.supabase.url, serviceRoleKey: config.supabase.serviceRoleKey });

  // (4) 데이터 조회 — 이 부분만 알림마다 다름
  //     const rows = await ...

  // (5) 보낼 게 없으면 스킵 (슬랙 전송 안 함)
  // if (rows.length === 0) return NextResponse.json({ status: 'skipped', reason: 'empty' }, { status: 200 });

  // (6) compose + 전송
  const text = composeWeeklyAbsenceMessage(rows, getTodayString());
  const result = await postSlackMessage(botToken, SLACK_CHANNELS.CONSULTATION, text);
  if (!result.ok) {
    return NextResponse.json({ error: `슬랙 전송 실패: ${result.error}` }, { status: 502 });
  }

  return NextResponse.json({ status: 'sent', date: getTodayString() }, { status: 200 });
}
```

**시간대 함정 (중요)**: 서버는 UTC다. "오늘"이 들어가는 판정(생일, 날짜 비교 등)은 반드시 `getNowKST()` / `getTodayString()`를 명시적으로 써라. `new Date()` 기본값을 그대로 넘기면 KST 아침 실행 시 UTC는 전날이라 날짜가 어긋난다. (생일 알림이 이 함정 때문에 한 번 어긋날 뻔했음.)

### Step 3. 채널 (필요 시에만)

- 기존 채널로 보내면 추가 작업 없음. 단, 채널명이 바뀔 수 있는 운영 채널은 Slack 채널 ID를 상수에 저장한다.
- **새 채널**이면:
  1. 슬랙에서 그 채널에 들어가 `/invite @alimi` (봇 초대 — 안 하면 `not_in_channel` 에러)
  2. `src/constants/slack-channels.ts`에 상수 한 줄 추가
  3. **환경변수는 건드리지 않는다** — 봇 토큰 하나가 모든 채널 공용

### Step 4. pg_cron 잡 등록

코드를 **푸시·배포한 뒤** Supabase에 잡을 등록한다 (Claude가 Supabase MCP `execute_sql`로 실행. 직접 SQL Editor에 붙여도 됨). project: `hgkhcbdixubimbraigen`.

```sql
SELECT cron.schedule(
  'weekly-absence-report',              -- jobname (동일 이름이면 갱신됨)
  '0 0 * * 1',                          -- UTC 기준. 예: KST 월요일 09:00
  $$
  SELECT net.http_post(
    url := 'https://dddaycare.vercel.app/api/internal/cron/weekly-absence-report',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET 실제값>',
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 15000
  )
  $$
);
```

- **cron 표현식은 UTC**다. KST에서 9시간을 빼라. (KST 08:30 → UTC 23:30 → `30 23 * * *`, KST 평일 12:05 → UTC 03:05 → `5 3 * * 1-5`)
- `CRON_SECRET` 실제값은 `.env.local`에 있다 (2026-06-11 rotate된 값). Vercel 환경변수·pg_cron 잡 command 두 곳이 같은 값이어야 한다.

## 3. 배포 순서 (반드시 지킬 것)

생일 알림 때 이 순서를 안 지켜서 첫날 알림이 누락된 적이 있다.

1. 코드 작성 → `npx tsc --noEmit` / `npx eslint src --quiet` / `npx vitest run` 통과 확인
2. 커밋 → **`git push`** (Vercel 자동 배포 트리거)
3. **배포 완료 대기** — 엔드포인트가 인증 없이 호출 시 404가 아니라 401을 반환하면 라이브
   ```bash
   curl -s -o /dev/null -w "%{http_code}" -X POST https://dddaycare.vercel.app/api/internal/cron/<이름>
   # 404 = 아직 배포 안 됨, 401 = 배포됨(인증 차단 정상)
   ```
4. **그 다음에** pg_cron 잡 등록 (Step 4)
5. 수동 1회 발사로 실전 검증:
   ```bash
   curl -s -X POST https://dddaycare.vercel.app/api/internal/cron/<이름> \
     -H "Authorization: Bearer <CRON_SECRET>"
   # {"status":"sent",...} 확인 + 슬랙 채널에 실제 메시지 도착 확인
   ```

> ⚠️ pg_cron 잡은 코드가 배포된 **뒤에** 등록하거나, 적어도 첫 발사 시각 전까지 배포가 끝나 있어야 한다. 라우트가 없으면 pg_cron은 404를 때리고 조용히 실패한다.

## 4. 운영·점검

```sql
-- 등록된 잡 목록
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

-- 최근 실행 이력 (성공/실패, KST 시각)
SELECT jobid, status, return_message, start_time AT TIME ZONE 'Asia/Seoul' AS start_kst
FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- 잡 중지/삭제
SELECT cron.unschedule('weekly-absence-report');
```

- `job_run_details.status = 'succeeded'`는 **HTTP 요청을 보냈다**는 뜻이지 슬랙 전송 성공이 아니다. 실제 전송 결과는 Vercel 함수 로그(`[timing]` 등) 또는 슬랙 채널로 확인.
- 알림이 안 왔을 때 점검 순서: ① `cron.job_run_details`에 실행 기록 있나 → ② 엔드포인트가 404인가(미배포) → ③ 수동 발사 응답 코드(401 인증, 503 토큰없음, 502 슬랙실패, 200 정상) → ④ 봇이 채널에 초대됐나.

## 5. 현재 등록된 크론잡

| jobname | 스케줄(UTC) | KST | 라우트 | 채널 |
|---|---|---|---|---|
| `noon-attendance-report` | `5 3 * * 1-5` | 평일 12:05 | noon-attendance-report | `#마루-진찰` (`C0B9LCED676`) |
| `birthday-report` | `30 23 * * *` | 매일 08:30 | birthday-report | `#마루` |

월간 리포트(`monthly-report-generate`)·공휴일 동기화(`holidays-sync`)는 **Vercel 크론**(vercel.json)으로 따로 돈다. 월간 리포트는 생성 후 `#마루-진찰`(`C0B9LCED676`)로 요약을 슬랙 통보한다.

## 6. 관련 문서

- `docs/HANDOFF.md` — 슬랙 알림 운영 정보 요약 (이 문서의 상위)
- `docs/superpowers/plans/2026-06-10-slack-noon-report.md` — 슬랙 연동 최초 설계·결정 기록

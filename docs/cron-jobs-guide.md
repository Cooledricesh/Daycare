# 크론잡(정기 알림) 추가 가이드

> **목적**: 새로운 정기 슬랙 알림(또는 배치 작업)을 추가하는 표준 절차.
> 새 알림을 만들 때 이 문서의 레시피를 그대로 따르면 환경변수를 건드릴 필요가 없다.
> 최종 갱신: 2026-08-18

## 0. 전체 그림 (현재 구조)

```
NAS daycare-scheduler (crond, UTC)
  └─ HTTPS POST ──Bearer CRON_SECRET──▶ Vercel 앱
                                      /api/internal/cron/<이름>
                                        ├─ CRON_SECRET 인증
                                        ├─ NAS Daycare API에서 데이터 조회
                                        ├─ compose 순수함수로 메시지 조립
                                        └─ postSlackMessage(...) → Slack
```

- 평일 정오 리포트·생일 리포트 스케줄은 NAS `/volume1/docker/daycare-api/scheduler.crontab`이 담당한다.
- 월간 리포트·공휴일 동기화 2개는 `vercel.json`의 Vercel Cron을 유지한다.
- 실제 데이터 가공·전송은 Vercel 앱이 하며 NAS scheduler는 인증된 HTTP POST만 수행한다.
- 기존 Supabase pg_cron은 이전 `CRON_SECRET`을 보유하므로 401로 차단된다.

## 1. 이미 존재하는 재사용 부품 (새로 만들지 말 것)

| 부품 | 위치 | 역할 |
|---|---|---|
| `postSlackMessage(botToken, channel, text)` | `src/server/integrations/slack/client.ts` | 슬랙 전송. 실패해도 throw 안 하고 `{ ok, error }` 반환 |
| `SLACK_CHANNELS` | `src/constants/slack-channels.ts` | 채널 상수 (`마루-진찰`은 채널 ID `C0B9LCED676`, `#마루` …) |
| `getTodayString()` / `getNowKST()` | `src/lib/date.ts` | KST 기준 오늘 날짜 / 현재 시각 Date |
| `getHolidayDatesMap()`, `isWeekend()` | `src/lib/business-days.ts` | 공휴일/주말 판정 |
| `createServiceClient()` + `getAppConfig()` | `src/server/supabase/client.ts`, `src/server/config` | NAS Daycare PostgREST 클라이언트(과거 이름 유지) |

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

### Step 4. NAS scheduler 등록

코드를 배포한 뒤 `nas/api/scheduler.crontab`에 UTC cron 표현식과 라우트 이름을 추가한다.

```cron
# KST 월요일 09:00 = UTC 월요일 00:00
0 0 * * 1 /opt/daycare/run-job.sh weekly-absence-report
```

변경한 `scheduler.crontab`과 `run-job.sh`를 `/volume1/docker/daycare-api/`에 배포한 뒤 `daycare-scheduler` 컨테이너만 재생성한다. `scheduler.env`의 `CRON_SECRET` 값은 Vercel Production과 같아야 하며 Git에 저장하지 않는다.

- cron 표현식은 UTC다. KST에서 9시간을 뺀다.
- 실제 알림을 보내지 않는 연결 점검은 `run-job.sh health`를 사용한다.

## 3. 배포 순서 (반드시 지킬 것)

생일 알림 때 이 순서를 안 지켜서 첫날 알림이 누락된 적이 있다.

1. 코드 작성 → `npx tsc --noEmit` / `npx eslint src --quiet` / `npx vitest run` 통과 확인
2. 커밋 → **`git push`** (Vercel 자동 배포 트리거)
3. **배포 완료 대기** — 엔드포인트가 인증 없이 호출 시 404가 아니라 401을 반환하면 라이브
   ```bash
   curl -s -o /dev/null -w "%{http_code}" -X POST https://dddaycare.vercel.app/api/internal/cron/<이름>
   # 404 = 아직 배포 안 됨, 401 = 배포됨(인증 차단 정상)
   ```
4. NAS scheduler 파일을 배포하고 `daycare-scheduler`만 재생성
5. 무부작용 검증: 컨테이너에서 `/opt/daycare/run-job.sh health` 실행 → `database:reachable` 확인
6. 실제 알림 라우트의 수동 발사는 사용자가 요청했거나 테스트 채널이 준비된 경우에만 수행

> ⚠️ 스케줄러는 코드가 배포된 뒤 활성화한다. 라우트가 없거나 `CRON_SECRET`이 다르면 404/401로 실패한다.

## 4. 운영·점검

```bash
# 컨테이너와 health
sudo docker ps --filter name=daycare-scheduler
sudo docker exec daycare-scheduler /opt/daycare/run-job.sh health

# 최근 실행 로그
sudo docker logs --tail 100 daycare-scheduler
```

- `health`가 200이면 scheduler → Vercel 인증 → NAS DB 조회까지 정상이다.
- 알림이 안 왔을 때 점검 순서: ① scheduler 컨테이너 healthy ② cron 표현식과 UTC 시간 ③ `run-job.sh health` ④ Vercel 함수 로그 ⑤ 봇 채널 초대·Slack 응답.

## 5. 현재 등록된 크론잡

| jobname | 스케줄(UTC) | KST | 라우트 | 채널 |
|---|---|---|---|---|
| `noon-attendance-report` | `0 7 * * 1-5` | 평일 16:00 | noon-attendance-report | `#마루-진찰` (`C0B9LCED676`) |
| `birthday-report` | `30 23 * * *` | 매일 08:30 | birthday-report | `#마루` |

위 두 잡은 NAS `daycare-scheduler`에서 실행한다. 월간 리포트(`monthly-report-generate`)·공휴일 동기화(`holidays-sync`)는 `vercel.json`의 Vercel Cron으로 실행한다.

## 6. 관련 문서

- `docs/HANDOFF.md` — 슬랙 알림 운영 정보 요약 (이 문서의 상위)
- `docs/superpowers/plans/2026-06-10-slack-noon-report.md` — 슬랙 연동 최초 설계·결정 기록

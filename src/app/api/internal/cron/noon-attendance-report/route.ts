import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getAppConfig } from '@/server/config';
import { createServiceClient } from '@/server/supabase/client';
import { getTodayString, getNowKST } from '@/lib/date';
import { isWeekend, getHolidayDatesMap, getClinicClosureDatesSet } from '@/lib/business-days';
import { getAttendanceBoard } from '@/features/attendance-board/backend/service';
import { fetchSlackChannelMessages, postSlackMessage } from '@/server/integrations/slack/client';
import { SLACK_CHANNELS } from '@/constants/slack-channels';
import { composeNoonReportMessage } from '@/server/services/noon-report';
import { ingestSlackConsultations } from '@/server/services/slack-consultation-ingest';

export const runtime = 'nodejs';

/**
 * KST 오늘 날짜를 "6월 10일 (수)" 형식으로 반환합니다.
 */
function formatKstDateLabel(kstDate: Date): string {
  return format(kstDate, 'M월 d일 (E)', { locale: ko });
}

function getKstDaySlackRange(date: string): { oldest: string; latest: string } {
  const start = new Date(`${date}T00:00:00+09:00`).getTime() / 1000;
  const now = Date.now() / 1000;
  const endOfDay = new Date(`${date}T23:59:59+09:00`).getTime() / 1000;

  return {
    oldest: String(start),
    latest: String(Math.min(now, endOfDay)),
  };
}

/**
 * POST /api/internal/cron/noon-attendance-report
 *
 * Vercel Cron 스케줄: 0 7 * * 1-5 (UTC) = KST 평일 16:00
 * KST 기준 당일 슬랙 #마루-진찰 기록을 Daycare 출석/진찰 DB에 반영한 뒤 현황을 전송합니다.
 * - 주말/공휴일은 스킵 (200 + status:'skipped')
 * - SLACK_BOT_TOKEN 미설정 시 503
 * - Slack Bot Token에는 chat:write + channels:history/groups:history 권한이 필요합니다.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET이 설정되지 않았습니다' },
      { status: 500 },
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '인증에 실패했습니다' }, { status: 401 });
  }

  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: 'SLACK_BOT_TOKEN이 설정되지 않았습니다' },
      { status: 503 },
    );
  }

  const todayStr = getTodayString();
  const nowKst = getNowKST();

  // 주말 스킵
  if (isWeekend(todayStr)) {
    return NextResponse.json(
      { status: 'skipped', reason: 'weekend' },
      { status: 200 },
    );
  }

  // 공휴일 스킵
  const config = getAppConfig();
  const supabase = createServiceClient({
    url: config.supabase.url,
    serviceRoleKey: config.supabase.serviceRoleKey,
  });

  const holidayMap = await getHolidayDatesMap(supabase, todayStr, todayStr);
  if (holidayMap.has(todayStr)) {
    return NextResponse.json(
      { status: 'skipped', reason: 'holiday', holiday: holidayMap.get(todayStr) },
      { status: 200 },
    );
  }

  // 휴진일 여부 (스킵하지 않고 진찰 요약만 생략)
  const closureSet = await getClinicClosureDatesSet(supabase, todayStr, todayStr);
  const isClinicClosed = closureSet.has(todayStr);

  const slackRange = getKstDaySlackRange(todayStr);
  const slackMessages = await fetchSlackChannelMessages(botToken, {
    channel: SLACK_CHANNELS.CONSULTATION,
    oldest: slackRange.oldest,
    latest: slackRange.latest,
    includeThreads: true,
  });
  const ingestResult = await ingestSlackConsultations(supabase, {
    date: todayStr,
    messages: slackMessages.map((message) => ({
      ts: message.ts,
      text: message.text || '',
      user: message.user,
      username: message.username,
      thread_ts: message.thread_ts,
    })),
    checkedAt: new Date().toISOString(),
  });

  // Slack 기록 반영 후 출석 보드 조회
  const board = await getAttendanceBoard(supabase, { date: todayStr });

  const dateLabel = formatKstDateLabel(nowKst);
  const messageText = composeNoonReportMessage(board, dateLabel, { clinicClosed: isClinicClosed });

  // 슬랙 전송
  const result = await postSlackMessage(botToken, SLACK_CHANNELS.CONSULTATION, messageText);

  if (!result.ok) {
    const errorMsg = 'error' in result ? result.error : '알 수 없는 오류';
    return NextResponse.json(
      { error: `슬랙 전송 실패: ${errorMsg}` },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      status: 'sent',
      date: todayStr,
      clinic_closed: isClinicClosed,
      total_attended: board.total_attended,
      total_scheduled: board.total_scheduled,
      total_consulted: board.total_consulted,
      slack_ingest: ingestResult,
    },
    { status: 200 },
  );
}

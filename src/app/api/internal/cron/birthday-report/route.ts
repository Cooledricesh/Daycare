import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getAppConfig } from '@/server/config';
import { createServiceClient } from '@/server/supabase/client';
import { getTodayString, getNowKST } from '@/lib/date';
import { isBirthdayToday } from '@/lib/birthday';
import { sendSlackMessage } from '@/server/integrations/slack/client';
import { composeBirthdayReportMessage } from '@/server/services/birthday-report';
import type { BirthdayPatient } from '@/server/services/birthday-report';

export const runtime = 'nodejs';

/**
 * KST 오늘 날짜를 "6월 11일 (목)" 형식으로 반환합니다.
 */
function formatKstDateLabel(kstDate: Date): string {
  return format(kstDate, 'M월 d일 (E)', { locale: ko });
}

/**
 * POST /api/internal/cron/birthday-report
 *
 * Supabase pg_cron 스케줄: 30 23 * * * (UTC) = KST 매일 08:30 (jobname: birthday-report)
 * 오늘 생일인 활성 환자가 있으면 슬랙 "마루" 채널로 축하 메시지를 전송합니다.
 * - 주말/공휴일 포함 매일 실행 (생일은 매일 체크)
 * - 생일자 0명이면 스킵 (200 + status:'skipped')
 * - SLACK_WEBHOOK_URL_MARU 미설정 시 503
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

  const webhookUrl = process.env.SLACK_WEBHOOK_URL_MARU;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'SLACK_WEBHOOK_URL_MARU이 설정되지 않았습니다' },
      { status: 503 },
    );
  }

  const todayStr = getTodayString();
  const nowKst = getNowKST();

  const config = getAppConfig();
  const supabase = createServiceClient({
    url: config.supabase.url,
    serviceRoleKey: config.supabase.serviceRoleKey,
  });

  // 활성 환자 중 birth_date가 있는 환자 조회
  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, name, display_name, room_number, birth_date')
    .eq('status', 'active')
    .not('birth_date', 'is', null);

  if (error) {
    return NextResponse.json(
      { error: `환자 조회 실패: ${error.message}` },
      { status: 500 },
    );
  }

  // KST 기준으로 오늘 생일인 환자 필터링
  const birthdayPatients: BirthdayPatient[] = (patients ?? [])
    .filter((p) => isBirthdayToday(p.birth_date as string, nowKst))
    .map((p) => ({
      name: p.name as string,
      display_name: p.display_name as string | null,
      room_number: p.room_number as string | null,
    }));

  if (birthdayPatients.length === 0) {
    return NextResponse.json(
      { status: 'skipped', reason: 'no_birthdays' },
      { status: 200 },
    );
  }

  const dateLabel = formatKstDateLabel(nowKst);
  const messageText = composeBirthdayReportMessage(birthdayPatients, dateLabel);

  // 슬랙 전송
  const result = await sendSlackMessage(webhookUrl, { text: messageText });

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
      birthday_count: birthdayPatients.length,
    },
    { status: 200 },
  );
}

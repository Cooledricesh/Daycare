import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/server/config';
import { createServiceClient } from '@/server/supabase/client';
import { generateMonthlyReport } from '@/features/monthly-report/backend/service';
import { MonthlyReportError } from '@/features/monthly-report/backend/error';

export const runtime = 'nodejs';

/** UTC 밀리초를 KST로 변환하여 전날 날짜 정보를 반환합니다 */
function getKstYesterdayInfo(): { year: number; month: number } {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const nowKstMs = Date.now() + KST_OFFSET_MS;
  const nowKst = new Date(nowKstMs);
  // 어제
  const yesterdayKstMs = nowKstMs - 24 * 60 * 60 * 1000;
  const yesterdayKst = new Date(yesterdayKstMs);

  void nowKst;

  return {
    year: yesterdayKst.getUTCFullYear(),
    month: yesterdayKst.getUTCMonth() + 1,
  };
}

/**
 * POST /api/internal/cron/monthly-report-generate
 *
 * Vercel Cron 스케줄: 30 15 1 * * (UTC) = KST 2일 00:30
 * 함수 내부: KST 기준 어제가 속한 달의 리포트 생성
 * - 이미 존재하면 skip (generated_by='cron')
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // CRON_SECRET 인증
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET이 설정되지 않았습니다' },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: '인증에 실패했습니다' },
      { status: 401 },
    );
  }

  // KST 기준 어제가 속한 달 계산
  const { year, month } = getKstYesterdayInfo();

  // Supabase 클라이언트 생성
  const config = getAppConfig();
  const supabase = createServiceClient({
    url: config.supabase.url,
    serviceRoleKey: config.supabase.serviceRoleKey,
  });

  // 이미 존재하는지 확인
  const { data: existing, error: checkError } = await supabase
    .from('monthly_reports')
    .select('id, generated_by')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (checkError) {
    return NextResponse.json(
      { error: `리포트 확인 실패: ${checkError.message}` },
      { status: 500 },
    );
  }

  if (existing) {
    return NextResponse.json(
      { year, month, status: 'skipped' },
      { status: 200 },
    );
  }

  // 리포트 생성
  try {
    await generateMonthlyReport(supabase, year, month, 'cron');
    return NextResponse.json(
      { year, month, status: 'generated' },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof MonthlyReportError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '알 수 없는 오류' },
      { status: 500 },
    );
  }
}

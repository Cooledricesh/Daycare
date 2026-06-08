import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/server/config';
import { createServiceClient } from '@/server/supabase/client';
import { syncHolidays } from '@/features/holidays/backend/sync';

export const runtime = 'nodejs';

/** KST 기준 현재 연도 */
function getKstYear(): number {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  return new Date(Date.now() + KST_OFFSET_MS).getUTCFullYear();
}

/**
 * POST /api/internal/cron/holidays-sync
 *
 * Vercel Cron 스케줄: 0 0 1 * * (UTC) = KST 매월 1일 09:00
 * 행정안전부 특일정보 API에서 (올해, 내년) 공휴일을 가져와 holidays 테이블에 upsert.
 * - 매월 실행하여 새로 지정된 임시공휴일(선거일 등)도 자동 반영
 * - HOLIDAY_API_KEY 미설정 시 503
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

  const serviceKey = process.env.HOLIDAY_API_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'HOLIDAY_API_KEY가 설정되지 않았습니다' },
      { status: 503 },
    );
  }

  const currentYear = getKstYear();
  const years = [currentYear, currentYear + 1];

  const config = getAppConfig();
  const supabase = createServiceClient({
    url: config.supabase.url,
    serviceRoleKey: config.supabase.serviceRoleKey,
  });

  try {
    const result = await syncHolidays(supabase, serviceKey, years);
    return NextResponse.json({ status: 'ok', ...result }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '알 수 없는 오류' },
      { status: 500 },
    );
  }
}

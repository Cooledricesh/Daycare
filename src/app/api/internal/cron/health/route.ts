import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig } from '@/server/config';
import { createServiceClient } from '@/server/supabase/client';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET이 설정되지 않았습니다' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '인증에 실패했습니다' }, { status: 401 });
  }

  const config = getAppConfig();
  const data = createServiceClient({
    url: config.supabase.url,
    serviceRoleKey: config.supabase.serviceRoleKey,
  });
  const { count, error } = await data
    .from('staff')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ status: 'error', error: error.message }, { status: 503 });
  }
  return NextResponse.json({ status: 'ok', database: 'reachable', staff_count: count }, { status: 200 });
}

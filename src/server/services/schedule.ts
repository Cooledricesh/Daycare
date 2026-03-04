import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * 해당 날짜에 auto 스케줄이 없으면 scheduled_patterns 기반으로 자동 생성
 */
export async function ensureScheduleGenerated(
  supabase: SupabaseClient<Database>,
  date: string,
): Promise<void> {
  const { count } = await (supabase
    .from('scheduled_attendances') as any)
    .select('*', { count: 'exact', head: true })
    .eq('date', date)
    .eq('source', 'auto');

  if ((count ?? 0) > 0) return;

  // 요일 계산
  const [y, m, d] = date.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();

  // 해당 요일의 active 패턴 조회 (active 환자만)
  const { data: patterns } = await (supabase
    .from('scheduled_patterns') as any)
    .select('patient_id, patients!inner(status)')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .eq('patients.status', 'active');

  if (!patterns || patterns.length === 0) return;

  const rows = patterns.map((p: any) => ({
    patient_id: p.patient_id,
    date,
    source: 'auto',
    is_cancelled: false,
  }));

  await (supabase
    .from('scheduled_attendances') as any)
    .upsert(rows, { onConflict: 'patient_id,date', ignoreDuplicates: true })
    .select('id');
}

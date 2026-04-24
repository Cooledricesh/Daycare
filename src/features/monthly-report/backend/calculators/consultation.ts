import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { ConsultationStats } from '../schema';

type Supabase = SupabaseClient<Database>;

/**
 * 진찰 통계를 계산합니다 (spec §4.4)
 *
 * consultations 테이블 자체가 "진찰 실시" 기록이며,
 * 예정 건수는 해당 월 출석일 기준으로 추산합니다.
 * - scheduled_count: 해당 월 scheduled_attendances 중 is_cancelled=false 건수
 * - performed_count: 해당 월 consultations 건수 (진찰 실시 = 레코드 존재)
 * - missed_count: scheduled - performed (0 이상으로 클램핑)
 * - missed_by_reason.absent: 진찰 예정이지만 attendances에 없는 환자 수
 * - missed_by_reason.other: missed - absent
 */
export async function calculateConsultationStats(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<ConsultationStats> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  // 월간 scheduled_attendances (예정된 출석 = 예정 진찰 기회)
  const { count: scheduledCount, error: schedErr } = await supabase
    .from('scheduled_attendances')
    .select('*', { count: 'exact', head: true })
    .gte('date', monthStart)
    .lt('date', nextMonth)
    .eq('is_cancelled', false);

  if (schedErr) throw new Error(`예정 출석 조회 실패: ${schedErr.message}`);

  // 월간 consultations (진찰 실시)
  const { count: performedCount, error: consErr } = await supabase
    .from('consultations')
    .select('*', { count: 'exact', head: true })
    .gte('date', monthStart)
    .lt('date', nextMonth);

  if (consErr) throw new Error(`진찰 기록 조회 실패: ${consErr.message}`);

  // 월간 attendances (실제 출석)
  const { count: attendanceCount, error: attErr } = await supabase
    .from('attendances')
    .select('*', { count: 'exact', head: true })
    .gte('date', monthStart)
    .lt('date', nextMonth);

  if (attErr) throw new Error(`출석 기록 조회 실패: ${attErr.message}`);

  const scheduled = scheduledCount ?? 0;
  const performed = performedCount ?? 0;
  const attended = attendanceCount ?? 0;

  // 누락 = 예정 - 실시 (음수는 0으로 클램핑)
  const missed = Math.max(0, scheduled - performed);

  // 결석으로 인한 누락 = 예정 - 실제출석 (진찰 못 받은 이유가 결석)
  const missedByAbsent = Math.max(0, scheduled - attended);
  const missedByOther = Math.max(0, missed - missedByAbsent);

  return {
    scheduled_count: scheduled,
    performed_count: performed,
    missed_count: missed,
    missed_by_reason: {
      absent: Math.min(missedByAbsent, missed),
      other: missedByOther,
    },
  };
}

/**
 * 진찰 참석률을 계산합니다 (spec §4.4)
 * = 진찰 실시 건수 / 출석 건수 * 100
 * (출석했을 때 진찰을 얼마나 받았는지)
 */
export async function calculateConsultationAttendanceRate(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<number> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const [{ count: attendanceCount }, { count: consultationCount }] =
    await Promise.all([
      supabase
        .from('attendances')
        .select('*', { count: 'exact', head: true })
        .gte('date', monthStart)
        .lt('date', nextMonth),
      supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true })
        .gte('date', monthStart)
        .lt('date', nextMonth),
    ]);

  const attended = attendanceCount ?? 0;
  const consulted = consultationCount ?? 0;

  if (attended === 0) return 0;

  return Math.min(Math.round((consulted / attended) * 10000) / 100, 100);
}

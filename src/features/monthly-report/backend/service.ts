import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';
import { MonthlyReportError, MonthlyReportErrorCodes } from './error';
import type {
  MonthlyReportResponse,
  MonthlyReportListItem,
} from './schema';
import {
  calculateTotalAttendanceDays,
  calculatePerPatientAvgDays,
  calculateDailyAvgAttendance,
  getRegisteredCountEom,
  getNewPatientCount,
  getWorkingDaysCount,
} from './calculators/attendance';
import {
  calculateConsultationStats,
  calculateConsultationAttendanceRate,
} from './calculators/consultation';
import {
  calculateWeeklyTrend,
  calculateWeekdayAvg,
  calculatePrevMonthComparison,
} from './calculators/trend';
import { calculateCoordinatorPerformance } from './calculators/coordinator';
import {
  getTopAttenders,
  getRiskPatients,
  getNewPatients,
} from './calculators/segments';
import { getDischargesFromSyncLogs } from './calculators/discharges';
import { getSpecialNotes } from './calculators/special-notes';
import {
  REPORT_MIN_YEAR,
  REPORT_MIN_MONTH,
} from '../constants/thresholds';

type Supabase = SupabaseClient<Database>;

/** 리포트 생성 가능 기간 검증 */
function validatePeriod(year: number, month: number): void {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 2026-03 이전
  if (year < REPORT_MIN_YEAR || (year === REPORT_MIN_YEAR && month < REPORT_MIN_MONTH)) {
    throw new MonthlyReportError(
      MonthlyReportErrorCodes.INVALID_PERIOD,
      `리포트는 ${REPORT_MIN_YEAR}-${String(REPORT_MIN_MONTH).padStart(2, '0')} 이후만 지원합니다`,
    );
  }

  // 미래 월
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    throw new MonthlyReportError(
      MonthlyReportErrorCodes.INVALID_PERIOD,
      '미래 월의 리포트는 생성할 수 없습니다',
    );
  }
}

/** DB 행을 MonthlyReportResponse로 변환 */
function rowToResponse(row: Record<string, unknown>): MonthlyReportResponse {
  return {
    id: row.id as string,
    year: row.year as number,
    month: row.month as number,
    total_attendance_days: row.total_attendance_days as number,
    per_patient_avg_days: Number(row.per_patient_avg_days),
    daily_avg_attendance: Number(row.daily_avg_attendance),
    consultation_attendance_rate: Number(row.consultation_attendance_rate),
    registered_count_eom: row.registered_count_eom as number,
    new_patient_count: row.new_patient_count as number,
    discharged_count: row.discharged_count as number,
    weekly_trend: (row.weekly_trend as MonthlyReportResponse['weekly_trend']) ?? [],
    weekday_avg: (row.weekday_avg as MonthlyReportResponse['weekday_avg']) ?? {
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
    },
    prev_month_comparison: (row.prev_month_comparison as MonthlyReportResponse['prev_month_comparison']) ?? {
      total_attendance_days_delta: 0,
      total_attendance_days_delta_pct: 0,
      per_patient_avg_days_delta: 0,
      daily_avg_attendance_delta: 0,
      consultation_rate_delta: 0,
      registered_count_delta: 0,
    },
    coordinator_performance: (row.coordinator_performance as MonthlyReportResponse['coordinator_performance']) ?? [],
    patient_segments: (row.patient_segments as MonthlyReportResponse['patient_segments']) ?? {
      top_attenders: [],
      risk_patients: [],
      new_patients: [],
      discharges: [],
    },
    consultation_stats: (row.consultation_stats as MonthlyReportResponse['consultation_stats']) ?? {
      scheduled_count: 0,
      performed_count: 0,
      missed_count: 0,
      missed_by_reason: { absent: 0, other: 0 },
    },
    special_notes: (row.special_notes as MonthlyReportResponse['special_notes']) ?? [],
    action_items: (row.action_items as string) ?? '',
    generated_at: row.generated_at as string,
    generated_by: row.generated_by as 'cron' | 'manual',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * 월간 리포트를 생성(또는 재계산)하여 UPSERT 합니다
 * action_items는 기존 값 보존 (재계산 시)
 */
export async function generateMonthlyReport(
  supabase: Supabase,
  year: number,
  month: number,
  generatedBy: 'cron' | 'manual',
): Promise<MonthlyReportResponse> {
  validatePeriod(year, month);

  try {
    // 기존 action_items 보존
    const { data: existing } = await supabase
      .from('monthly_reports')
      .select('action_items')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    const preservedActionItems = existing?.action_items ?? '';

    // 전월 리포트 조회 (prev_month_comparison 계산용)
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    const prevReportQuery = supabase
      .from('monthly_reports')
      .select('*')
      .eq('year', prevYear)
      .eq('month', prevMonth)
      .maybeSingle();

    const [
      totalAttendanceDays,
      { workingDays },
      registeredCountEom,
      newPatientCount,
      consultationAttendanceRate,
      consultationStats,
      weeklyTrend,
      weekdayAvg,
      coordinatorPerformance,
      topAttenders,
      riskPatients,
      newPatients,
      discharges,
      specialNotes,
      prevReportResult,
    ] = await Promise.all([
      calculateTotalAttendanceDays(supabase, year, month),
      getWorkingDaysCount(supabase, year, month),
      getRegisteredCountEom(supabase, year, month),
      getNewPatientCount(supabase, year, month),
      calculateConsultationAttendanceRate(supabase, year, month),
      calculateConsultationStats(supabase, year, month),
      calculateWeeklyTrend(supabase, year, month),
      calculateWeekdayAvg(supabase, year, month),
      calculateCoordinatorPerformance(supabase, year, month),
      getTopAttenders(supabase, year, month),
      getRiskPatients(supabase, year, month),
      getNewPatients(supabase, year, month),
      getDischargesFromSyncLogs(supabase, year, month),
      getSpecialNotes(supabase, year, month),
      prevReportQuery,
    ]);

    const prevReport = prevReportResult.data;

    const perPatientAvgDays = calculatePerPatientAvgDays(
      totalAttendanceDays,
      registeredCountEom,
    );
    const dailyAvgAttendance = calculateDailyAvgAttendance(
      totalAttendanceDays,
      workingDays,
    );

    type PrevReportRow = Database['public']['Tables']['monthly_reports']['Row'];
    const typedPrevReport = prevReport as PrevReportRow | null;

    const prevMonthComparison = calculatePrevMonthComparison(
      {
        total_attendance_days: totalAttendanceDays,
        per_patient_avg_days: perPatientAvgDays,
        daily_avg_attendance: dailyAvgAttendance,
        consultation_attendance_rate: consultationAttendanceRate,
        registered_count_eom: registeredCountEom,
      },
      typedPrevReport
        ? {
            total_attendance_days: typedPrevReport.total_attendance_days,
            per_patient_avg_days: Number(typedPrevReport.per_patient_avg_days),
            daily_avg_attendance: Number(typedPrevReport.daily_avg_attendance),
            consultation_attendance_rate: Number(typedPrevReport.consultation_attendance_rate),
            registered_count_eom: typedPrevReport.registered_count_eom,
          }
        : null,
    );

    const patientSegments = {
      top_attenders: topAttenders,
      risk_patients: riskPatients,
      new_patients: newPatients,
      discharges,
    };

    const upsertData: Database['public']['Tables']['monthly_reports']['Insert'] = {
      year,
      month,
      total_attendance_days: totalAttendanceDays,
      per_patient_avg_days: perPatientAvgDays,
      daily_avg_attendance: dailyAvgAttendance,
      consultation_attendance_rate: consultationAttendanceRate,
      registered_count_eom: registeredCountEom,
      new_patient_count: newPatientCount,
      discharged_count: discharges.length,
      weekly_trend: weeklyTrend as unknown as Json,
      weekday_avg: weekdayAvg as unknown as Json,
      prev_month_comparison: prevMonthComparison as unknown as Json,
      coordinator_performance: coordinatorPerformance as unknown as Json,
      patient_segments: patientSegments as unknown as Json,
      consultation_stats: consultationStats as unknown as Json,
      special_notes: specialNotes as unknown as Json,
      action_items: preservedActionItems,
      generated_at: new Date().toISOString(),
      generated_by: generatedBy,
    };

    const { data, error } = await supabase
      .from('monthly_reports')
      .upsert(upsertData, { onConflict: 'year,month' })
      .select()
      .single();

    if (error || !data) {
      throw new MonthlyReportError(
        MonthlyReportErrorCodes.GENERATION_FAILED,
        `리포트 저장 실패: ${error?.message ?? '알 수 없는 오류'}`,
      );
    }

    return rowToResponse(data as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof MonthlyReportError) throw err;
    throw new MonthlyReportError(
      MonthlyReportErrorCodes.GENERATION_FAILED,
      `리포트 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
    );
  }
}

/**
 * 월간 리포트를 조회합니다. 없으면 즉시 생성 후 반환합니다 (lazy generation)
 */
export async function getMonthlyReport(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<MonthlyReportResponse> {
  validatePeriod(year, month);

  const { data, error } = await supabase
    .from('monthly_reports')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (error) {
    throw new MonthlyReportError(
      MonthlyReportErrorCodes.GENERATION_FAILED,
      `리포트 조회 실패: ${error.message}`,
    );
  }

  if (!data) {
    return generateMonthlyReport(supabase, year, month, 'manual');
  }

  return rowToResponse(data as unknown as Record<string, unknown>);
}

/**
 * 월간 리포트를 강제 재계산합니다 (action_items 보존)
 */
export async function regenerateMonthlyReport(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<MonthlyReportResponse> {
  validatePeriod(year, month);
  return generateMonthlyReport(supabase, year, month, 'manual');
}

/**
 * 액션 아이템 메모를 업데이트합니다
 */
export async function updateActionItems(
  supabase: Supabase,
  year: number,
  month: number,
  actionItems: string,
): Promise<{ success: true; updated_at: string }> {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('monthly_reports')
    .update({
      action_items: actionItems,
      updated_at: updatedAt,
    })
    .eq('year', year)
    .eq('month', month);

  if (error) {
    throw new MonthlyReportError(
      MonthlyReportErrorCodes.NOT_FOUND,
      `리포트를 찾을 수 없거나 업데이트 실패: ${error.message}`,
    );
  }

  return { success: true, updated_at: updatedAt };
}

/**
 * 생성된 리포트 목록(연도/월/generated_at)을 반환합니다
 */
export async function listMonthlyReports(
  supabase: Supabase,
): Promise<MonthlyReportListItem[]> {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('year, month, generated_at')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) {
    throw new MonthlyReportError(
      MonthlyReportErrorCodes.GENERATION_FAILED,
      `리포트 목록 조회 실패: ${error.message}`,
    );
  }

  return (data ?? []).map((row) => ({
    year: row.year,
    month: row.month,
    generated_at: row.generated_at ?? new Date().toISOString(),
  }));
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';
import { isWeekend, getHolidayDatesMap } from '@/lib/business-days';
import { STATS_DATA_START_DATE } from '@/features/shared/constants/stats';
import { calculateRiskLevel, calculateTrend } from '../lib/risk-calculator';
import { PERIOD_DAYS } from '../constants/risk-thresholds';
import { AbsenceRiskError, AbsenceRiskErrorCode } from './error';
import type {
  GetAbsenceOverviewQuery,
  GetAbsenceDetailQuery,
  AbsenceOverviewItem,
  PatientAbsenceDetail,
  AbsenceDailyRecord,
} from './schema';
import type { Database } from '@/lib/supabase/types';

const PAGE_SIZE = 1000;

function getPeriodDates(period: GetAbsenceOverviewQuery['period']): {
  startDate: string;
  endDate: string;
  halfDate: string;
} {
  const today = new Date();
  const days = PERIOD_DAYS[period];
  const endDate = format(today, 'yyyy-MM-dd');

  const rawStart = format(subDays(today, days), 'yyyy-MM-dd');
  const startDate = rawStart < STATS_DATA_START_DATE ? STATS_DATA_START_DATE : rawStart;

  const rawHalf = format(subDays(today, Math.floor(days / 2)), 'yyyy-MM-dd');
  const halfDate = rawHalf < STATS_DATA_START_DATE ? STATS_DATA_START_DATE : rawHalf;

  return { startDate, endDate, halfDate };
}

async function fetchAllRows<T>(
  buildQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new AbsenceRiskError(
        AbsenceRiskErrorCode.FETCH_FAILED,
        `데이터 조회 실패: ${error.message}`,
      );
    }

    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

type PatientAttendanceMap = Map<
  string,
  { scheduledDates: Set<string>; attendedDates: Set<string> }
>;

interface PatientDateRow {
  patient_id: string;
  date: string;
}

function buildPatientAttendanceMap(
  scheduledAttendances: PatientDateRow[],
  attendances: PatientDateRow[],
): PatientAttendanceMap {
  const map: PatientAttendanceMap = new Map();

  for (const sa of scheduledAttendances) {
    if (!map.has(sa.patient_id)) {
      map.set(sa.patient_id, { scheduledDates: new Set(), attendedDates: new Set() });
    }
    map.get(sa.patient_id)!.scheduledDates.add(sa.date);
  }

  for (const a of attendances) {
    if (!map.has(a.patient_id)) {
      map.set(a.patient_id, { scheduledDates: new Set(), attendedDates: new Set() });
    }
    map.get(a.patient_id)!.attendedDates.add(a.date);
  }

  return map;
}

function calculateConsecutiveAbsences(
  scheduledDates: Set<string>,
  attendedDates: Set<string>,
  holidayMap: Map<string, string>,
  endDate: string,
): number {
  let count = 0;
  let cursor = parseISO(endDate);

  for (let i = 0; i < 365; i++) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    if (dateStr < STATS_DATA_START_DATE) break;

    if (isWeekend(dateStr) || holidayMap.has(dateStr)) {
      cursor = subDays(cursor, 1);
      continue;
    }

    if (!scheduledDates.has(dateStr)) {
      cursor = subDays(cursor, 1);
      continue;
    }

    if (attendedDates.has(dateStr)) {
      break;
    }

    count++;
    cursor = subDays(cursor, 1);
  }

  return count;
}

function calculateAttendanceRateForPeriod(
  scheduledDates: Set<string>,
  attendedDates: Set<string>,
  holidayMap: Map<string, string>,
  startDate: string,
  endDate: string,
): number {
  const scheduled = [...scheduledDates].filter(
    d => d >= startDate && d <= endDate && !holidayMap.has(d),
  );
  if (scheduled.length === 0) return 100;
  const attended = scheduled.filter(d => attendedDates.has(d));
  return Math.round((attended.length / scheduled.length) * 100);
}

interface AbsencePatientRow {
  id: string;
  name: string;
  display_name: string | null;
  room_number: string | null;
  coordinator: { id: string; name: string } | null;
}

export async function getAbsenceOverview(
  supabase: SupabaseClient<Database>,
  query: GetAbsenceOverviewQuery,
): Promise<AbsenceOverviewItem[]> {
  const { startDate, endDate, halfDate } = getPeriodDates(query.period);

  const patientsQueryBase = supabase.from('patients')
    .select('id, name, display_name, room_number, coordinator:staff!patients_coordinator_id_fkey(id, name)')
    .eq('status', 'active');

  const patientsQuery = query.coordinator_id
    ? patientsQueryBase.eq('coordinator_id', query.coordinator_id)
    : patientsQueryBase;

  const [patientsResult, scheduledAttendances, attendances, holidayMap] = await Promise.all([
    patientsQuery.returns<AbsencePatientRow[]>(),
    fetchAllRows<PatientDateRow>(() =>
      supabase.from('scheduled_attendances')
        .select('patient_id, date')
        .eq('is_cancelled', false)
        .gte('date', startDate)
        .lte('date', endDate)
        .returns<PatientDateRow[]>(),
    ),
    fetchAllRows<PatientDateRow>(() =>
      supabase.from('attendances')
        .select('patient_id, date')
        .gte('date', startDate)
        .lte('date', endDate)
        .returns<PatientDateRow[]>(),
    ),
    getHolidayDatesMap(supabase, startDate, endDate),
  ]);

  const patients = patientsResult.data || [];

  const attendanceMap = buildPatientAttendanceMap(scheduledAttendances, attendances);

  const result: AbsenceOverviewItem[] = [];

  for (const patient of patients) {
    const patientData = attendanceMap.get(patient.id);
    const scheduledDates = patientData?.scheduledDates || new Set<string>();
    const attendedDates = patientData?.attendedDates || new Set<string>();

    const totalScheduled = [...scheduledDates].filter(d => !holidayMap.has(d)).length;
    if (totalScheduled === 0) continue;

    const totalAttended = [...scheduledDates].filter(
      d => !holidayMap.has(d) && attendedDates.has(d),
    ).length;
    const totalAbsent = totalScheduled - totalAttended;
    const attendanceRate = Math.round((totalAttended / totalScheduled) * 100);

    const consecutiveAbsences = calculateConsecutiveAbsences(
      scheduledDates,
      attendedDates,
      holidayMap,
      endDate,
    );

    const recentRate = calculateAttendanceRateForPeriod(
      scheduledDates,
      attendedDates,
      holidayMap,
      halfDate,
      endDate,
    );

    const previousRate = calculateAttendanceRateForPeriod(
      scheduledDates,
      attendedDates,
      holidayMap,
      startDate,
      format(subDays(parseISO(halfDate), 1), 'yyyy-MM-dd'),
    );

    const riskLevel = calculateRiskLevel(consecutiveAbsences, attendanceRate);
    const trend = calculateTrend(recentRate, previousRate);

    const lastAttendedDate =
      [...attendedDates]
        .filter(d => scheduledDates.has(d))
        .sort()
        .reverse()[0] || null;

    result.push({
      patient_id: patient.id,
      name: patient.name,
      display_name: patient.display_name,
      room_number: patient.room_number,
      coordinator_name: patient.coordinator?.name || null,
      consecutive_absences: consecutiveAbsences,
      attendance_rate: attendanceRate,
      total_scheduled: totalScheduled,
      total_attended: totalAttended,
      total_absent: totalAbsent,
      risk_level: riskLevel,
      trend,
      last_attended_date: lastAttendedDate,
      recent_rate: recentRate,
      previous_rate: previousRate,
    });
  }

  const riskOrder: Record<string, number> = { high: 2, medium: 1, low: 0 };
  result.sort((a, b) => {
    const riskDiff = riskOrder[b.risk_level] - riskOrder[a.risk_level];
    if (riskDiff !== 0) return riskDiff;
    return b.consecutive_absences - a.consecutive_absences;
  });

  return result;
}

interface DetailPatientRow {
  id: string;
  name: string;
  display_name: string | null;
  room_number: string | null;
  coordinator: { name: string } | null;
}

interface ScheduledPatternRow {
  day_of_week: number;
  is_active: boolean;
}

interface ScheduledAttendanceRow {
  date: string;
  is_cancelled: boolean;
}

interface AttendanceDateRow {
  date: string;
}

export async function getAbsenceDetail(
  supabase: SupabaseClient<Database>,
  patientId: string,
  query: GetAbsenceDetailQuery,
): Promise<PatientAbsenceDetail> {
  const { startDate, endDate, halfDate } = getPeriodDates(query.period);

  const [patientResult, patternsResult, scheduledResult, attendedResult, holidayMap] =
    await Promise.all([
      supabase.from('patients')
        .select('id, name, display_name, room_number, coordinator:staff!patients_coordinator_id_fkey(name)')
        .eq('id', patientId)
        .returns<DetailPatientRow[]>()
        .single(),
      supabase.from('scheduled_patterns')
        .select('day_of_week, is_active')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .returns<ScheduledPatternRow[]>(),
      supabase.from('scheduled_attendances')
        .select('date, is_cancelled')
        .eq('patient_id', patientId)
        .eq('is_cancelled', false)
        .gte('date', startDate)
        .lte('date', endDate)
        .limit(30000)
        .returns<ScheduledAttendanceRow[]>(),
      supabase.from('attendances')
        .select('date')
        .eq('patient_id', patientId)
        .gte('date', startDate)
        .lte('date', endDate)
        .limit(30000)
        .returns<AttendanceDateRow[]>(),
      getHolidayDatesMap(supabase, startDate, endDate),
    ]);

  if (!patientResult.data) {
    throw new AbsenceRiskError(
      AbsenceRiskErrorCode.PATIENT_NOT_FOUND,
      '환자를 찾을 수 없습니다',
    );
  }

  const patient = patientResult.data;
  const patterns = patternsResult.data || [];
  const scheduledAttendances = scheduledResult.data || [];
  const attendances = attendedResult.data || [];

  const scheduledDates = new Set(scheduledAttendances.map(s => s.date));
  const attendedDates = new Set(attendances.map(a => a.date));

  const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;
  const schedulePattern = patterns
    .map(p => DAY_KO[p.day_of_week])
    .join(',');

  const allDates = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  const dailyRecords: AbsenceDailyRecord[] = allDates.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const weekend = isWeekend(dateStr);
    const isHoliday = holidayMap.has(dateStr);
    const holidayReason = holidayMap.get(dateStr);
    const scheduled = scheduledDates.has(dateStr);
    const attended = attendedDates.has(dateStr);

    return {
      date: dateStr,
      scheduled,
      attended,
      is_holiday: isHoliday,
      is_weekend: weekend,
      ...(holidayReason ? { holiday_reason: holidayReason } : {}),
    };
  });

  const totalScheduled = [...scheduledDates].filter(d => !holidayMap.has(d)).length;
  const totalAttended = [...scheduledDates].filter(
    d => !holidayMap.has(d) && attendedDates.has(d),
  ).length;
  const totalAbsent = totalScheduled - totalAttended;
  const attendanceRate = totalScheduled > 0
    ? Math.round((totalAttended / totalScheduled) * 100)
    : 100;

  const consecutiveAbsences = calculateConsecutiveAbsences(
    scheduledDates,
    attendedDates,
    holidayMap,
    endDate,
  );

  const recentRate = calculateAttendanceRateForPeriod(
    scheduledDates,
    attendedDates,
    holidayMap,
    halfDate,
    endDate,
  );

  const previousRate = calculateAttendanceRateForPeriod(
    scheduledDates,
    attendedDates,
    holidayMap,
    startDate,
    format(subDays(parseISO(halfDate), 1), 'yyyy-MM-dd'),
  );

  const riskLevel = calculateRiskLevel(consecutiveAbsences, attendanceRate);
  const trend = calculateTrend(recentRate, previousRate);

  const lastAttendedDate =
    [...attendedDates]
      .filter(d => scheduledDates.has(d))
      .sort()
      .reverse()[0] || null;

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      display_name: patient.display_name,
      room_number: patient.room_number,
      coordinator_name: patient.coordinator?.name || null,
    },
    summary: {
      consecutive_absences: consecutiveAbsences,
      attendance_rate: attendanceRate,
      total_scheduled: totalScheduled,
      total_attended: totalAttended,
      total_absent: totalAbsent,
      risk_level: riskLevel,
      trend,
      last_attended_date: lastAttendedDate,
      recent_rate: recentRate,
      previous_rate: previousRate,
      schedule_pattern: schedulePattern,
    },
    daily_records: dailyRecords,
    period: query.period,
  };
}

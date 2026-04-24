import type { SupabaseClient } from '@supabase/supabase-js';
import { eachDayOfInterval, isWeekend, startOfMonth, endOfMonth, format } from 'date-fns';
import type { Database } from '@/lib/supabase/types';
import type { CoordinatorPerformanceEntry } from '../schema';
import { fetchAllWithPagination } from './attendance';
import {
  COORDINATOR_CONSECUTIVE_ABSENCE_DAYS,
} from '../../constants/thresholds';

type Supabase = SupabaseClient<Database>;

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * 환자의 해당 월 최장 연속 결석 일수를 계산합니다 (spec §4.9)
 * scheduled_attendances에 있지만 attendances에 없는 날을 결석으로 간주
 */
function calculateLongestConsecutiveAbsence(
  scheduledDates: Set<string>,
  attendedDates: Set<string>,
  workingDays: string[],
): number {
  let longest = 0;
  let current = 0;

  for (const dateStr of workingDays) {
    if (!scheduledDates.has(dateStr)) {
      // 예정 없는 날은 결석 카운트 리셋
      current = 0;
      continue;
    }
    if (attendedDates.has(dateStr)) {
      // 출석
      current = 0;
    } else {
      // 결석
      current += 1;
      longest = Math.max(longest, current);
    }
  }

  return longest;
}

/**
 * 코디별 성과를 계산합니다 (spec §2.2 coordinator_performance)
 */
export async function calculateCoordinatorPerformance(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<CoordinatorPerformanceEntry[]> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const monthStartStr = formatDate(monthStart);
  const monthEndStr = formatDate(monthEnd);

  // 영업일 목록 (주말 제외, 공휴일 미제외 - 공휴일 제외는 복잡도 대비 효과 작아 생략)
  const allWorkingDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    .filter((d) => !isWeekend(d))
    .map(formatDate);

  // 코디네이터 목록
  const coordinators = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('staff')
      .select('id, name')
      .eq('role', 'coordinator')
      .eq('is_active', true)
      .range(from, to);

    if (error) throw new Error(`코디네이터 조회 실패: ${error.message}`);
    return data ?? [];
  });

  if (coordinators.length === 0) return [];

  // 코디별 담당 active 환자 목록
  const patients = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('patients')
      .select('id, coordinator_id')
      .eq('status', 'active')
      .range(from, to);

    if (error) throw new Error(`환자 조회 실패: ${error.message}`);
    return data ?? [];
  });

  // 해당 월 전체 출석 데이터
  const attendances = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('attendances')
      .select('patient_id, date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .range(from, to);

    if (error) throw new Error(`출석 조회 실패: ${error.message}`);
    return data ?? [];
  });

  // 해당 월 전체 예정 출석 데이터
  const scheduled = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('scheduled_attendances')
      .select('patient_id, date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .eq('is_cancelled', false)
      .range(from, to);

    if (error) throw new Error(`예정 출석 조회 실패: ${error.message}`);
    return data ?? [];
  });

  // 해당 월 전체 진찰 데이터
  const consultations = await fetchAllWithPagination(async (from, to) => {
    const { data, error } = await supabase
      .from('consultations')
      .select('patient_id, date')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr)
      .range(from, to);

    if (error) throw new Error(`진찰 조회 실패: ${error.message}`);
    return data ?? [];
  });

  // 환자별 출석/예정/진찰 세트 구성
  const attendedByPatient = new Map<string, Set<string>>();
  for (const att of attendances) {
    if (!attendedByPatient.has(att.patient_id)) {
      attendedByPatient.set(att.patient_id, new Set());
    }
    attendedByPatient.get(att.patient_id)!.add(att.date);
  }

  const scheduledByPatient = new Map<string, Set<string>>();
  for (const sch of scheduled) {
    if (!scheduledByPatient.has(sch.patient_id)) {
      scheduledByPatient.set(sch.patient_id, new Set());
    }
    scheduledByPatient.get(sch.patient_id)!.add(sch.date);
  }

  const consultedByPatient = new Map<string, Set<string>>();
  for (const con of consultations) {
    if (!consultedByPatient.has(con.patient_id)) {
      consultedByPatient.set(con.patient_id, new Set());
    }
    consultedByPatient.get(con.patient_id)!.add(con.date);
  }

  // 코디별 결과 계산
  const coordinatorPatients = new Map<string, typeof patients>();
  for (const coordinator of coordinators) {
    coordinatorPatients.set(
      coordinator.id,
      patients.filter((p) => p.coordinator_id === coordinator.id),
    );
  }

  return coordinators.map((coordinator) => {
    const assignedPatients = coordinatorPatients.get(coordinator.id) ?? [];
    const assignedCount = assignedPatients.length;

    if (assignedCount === 0) {
      return {
        coordinator_id: coordinator.id,
        coordinator_name: coordinator.name,
        assigned_patient_count: 0,
        avg_attendance_rate: 0,
        consultation_attendance_rate: 0,
        consecutive_absence_patient_count: 0,
      };
    }

    let totalAttendanceRate = 0;
    let totalConsultationRate = 0;
    let consecutiveAbsenceCount = 0;

    for (const patient of assignedPatients) {
      const attended = attendedByPatient.get(patient.id) ?? new Set<string>();
      const scheduledSet = scheduledByPatient.get(patient.id) ?? new Set<string>();
      const consulted = consultedByPatient.get(patient.id) ?? new Set<string>();

      const possibleDays = scheduledSet.size;
      const attendedDays = attended.size;
      const consultedDays = consulted.size;

      // 출석률 (예정 대비)
      const attendanceRate =
        possibleDays > 0
          ? Math.min((attendedDays / possibleDays) * 100, 100)
          : 0;
      totalAttendanceRate += attendanceRate;

      // 진찰 참석률 (출석 대비)
      const consultationRate =
        attendedDays > 0
          ? Math.min((consultedDays / attendedDays) * 100, 100)
          : 0;
      totalConsultationRate += consultationRate;

      // 연속 COORDINATOR_CONSECUTIVE_ABSENCE_DAYS 이상 결석 여부
      const longestAbsence = calculateLongestConsecutiveAbsence(
        scheduledSet,
        attended,
        allWorkingDays,
      );
      if (longestAbsence >= COORDINATOR_CONSECUTIVE_ABSENCE_DAYS) {
        consecutiveAbsenceCount += 1;
      }
    }

    return {
      coordinator_id: coordinator.id,
      coordinator_name: coordinator.name,
      assigned_patient_count: assignedCount,
      avg_attendance_rate:
        Math.round((totalAttendanceRate / assignedCount) * 100) / 100,
      consultation_attendance_rate:
        Math.round((totalConsultationRate / assignedCount) * 100) / 100,
      consecutive_absence_patient_count: consecutiveAbsenceCount,
    };
  });
}

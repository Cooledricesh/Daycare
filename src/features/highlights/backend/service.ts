import type { SupabaseClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';
import { isBirthdayToday } from '@/lib/birthday';
import type { Database } from '@/lib/supabase/types';
import { fetchAllPaginated } from '@/lib/supabase-pagination';
import type { HighlightPatient, TodayHighlightsResponse } from './schema';
import { HighlightsError, HighlightsErrorCode } from './error';

type DB = SupabaseClient<Database>;

interface PatientRow {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  room_number: string | null;
  birth_date: string | null;
  created_at: string;
  status: string;
}

function toHighlightPatient(row: PatientRow, meta?: string): HighlightPatient {
  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    room_number: row.room_number,
    meta,
  };
}

export async function computeTodayHighlights(
  supabase: DB,
  now: Date = new Date(),
): Promise<TodayHighlightsResponse> {
  const todayStr = format(now, 'yyyy-MM-dd');
  const fourteenDaysAgo = format(subDays(now, 14), 'yyyy-MM-dd');

  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, name, display_name, avatar_url, room_number, birth_date, created_at, status')
    .eq('status', 'active');

  if (patientsError) {
    throw new HighlightsError(
      HighlightsErrorCode.FETCH_FAILED,
      `환자 조회 실패: ${patientsError.message}`,
    );
  }

  const activePatients = (patients || []) as unknown as PatientRow[];

  // 14일 범위도 환자 수(275명) × 날짜로 1000행 서버캡을 넘길 수 있어 페이지네이션 필수
  const [attRows, schRows, consRows] = await Promise.all([
    fetchAllPaginated<{ patient_id: string; date: string }>(() =>
      supabase
        .from('attendances')
        .select('patient_id, date')
        .gte('date', fourteenDaysAgo)
        .lte('date', todayStr)
        .order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; date: string; is_cancelled: boolean }>(() =>
      supabase
        .from('scheduled_attendances')
        .select('patient_id, date, is_cancelled')
        .gte('date', fourteenDaysAgo)
        .lte('date', todayStr)
        .order('id'),
    ),
    fetchAllPaginated<{ patient_id: string; date: string }>(() =>
      supabase
        .from('consultations')
        .select('patient_id, date')
        .gte('date', fourteenDaysAgo)
        .lte('date', todayStr)
        .order('id'),
    ),
  ]);

  const attendanceMap = new Map<string, Set<string>>();
  const scheduledMap = new Map<string, Set<string>>();
  const consultationTodaySet = new Set<string>();
  const attendanceTodaySet = new Set<string>();

  for (const row of attRows) {
    if (!attendanceMap.has(row.patient_id)) attendanceMap.set(row.patient_id, new Set());
    attendanceMap.get(row.patient_id)!.add(row.date);
    if (row.date === todayStr) attendanceTodaySet.add(row.patient_id);
  }
  for (const row of schRows) {
    if (row.is_cancelled) continue;
    if (!scheduledMap.has(row.patient_id)) scheduledMap.set(row.patient_id, new Set());
    scheduledMap.get(row.patient_id)!.add(row.date);
  }
  for (const row of consRows) {
    if (row.date === todayStr) consultationTodaySet.add(row.patient_id);
  }

  const threeDayAbsence: HighlightPatient[] = [];
  const suddenAbsence: HighlightPatient[] = [];
  const examMissed: HighlightPatient[] = [];
  const birthdays: HighlightPatient[] = [];
  const newlyRegistered: HighlightPatient[] = [];

  const recent3Days = [0, 1, 2].map((offset) => format(subDays(now, offset), 'yyyy-MM-dd'));

  // 진찰이 KST 12시에 끝나므로 그 이전에는 결석/진찰누락을 단정할 수 없다.
  // 정오 이전엔 해당 카드들을 비워서 false positive를 차단하고, 정오 이후에만 판정한다.
  // KST = UTC+9 이므로 KST 정오 = UTC 03:00.
  const kstHour = (now.getUTCHours() + 9) % 24;
  const isPastNoonKst = kstHour >= 12;

  for (const p of activePatients) {
    const scheduled = scheduledMap.get(p.id) || new Set<string>();
    const attended = attendanceMap.get(p.id) || new Set<string>();

    if (isPastNoonKst) {
      const recentScheduled = recent3Days.filter((d) => scheduled.has(d));
      const recentAttended = recent3Days.filter((d) => attended.has(d));
      if (recentScheduled.length >= 3 && recentAttended.length === 0) {
        threeDayAbsence.push(toHighlightPatient(p, '3일 연속 결석'));
      }

      const scheduledCount = scheduled.size;
      const attendedCount = attended.size;
      if (
        scheduledCount >= 5 &&
        attendedCount / scheduledCount >= 0.9 &&
        scheduled.has(todayStr) &&
        !attended.has(todayStr)
      ) {
        suddenAbsence.push(toHighlightPatient(p, '평소 개근자'));
      }

      if (attendanceTodaySet.has(p.id) && !consultationTodaySet.has(p.id)) {
        examMissed.push(toHighlightPatient(p));
      }
    }

    if (isBirthdayToday(p.birth_date, now)) {
      birthdays.push(toHighlightPatient(p, '생일'));
    }

    if (p.created_at && p.created_at.slice(0, 10) === todayStr) {
      newlyRegistered.push(toHighlightPatient(p, '신규 등록'));
    }
  }

  return {
    date: todayStr,
    events: {
      threeDayAbsence: threeDayAbsence.slice(0, 10),
      suddenAbsence: suddenAbsence.slice(0, 10),
      examMissed: examMissed.slice(0, 10),
      birthdays,
      newlyRegistered,
    },
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { DischargeEntry } from '../schema';

type Supabase = SupabaseClient<Database>;

/**
 * sync_logs 기반으로 해당 월 퇴원 환자 목록을 가져옵니다 (spec §4.5)
 *
 * sync_logs.details.changes JSONB 배열에서 action이
 * 'ward_admission' / 'activity_stop' 인 항목을 추출합니다.
 * 하위 호환: 기존 'discharge' 액션은 'activity_stop' 으로 매핑합니다
 * (SyncNotificationBanner 와 동일 규칙).
 */
export async function getDischargesFromSyncLogs(
  supabase: Supabase,
  year: number,
  month: number,
): Promise<DischargeEntry[]> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const { data: syncLogs, error } = await supabase
    .from('sync_logs')
    .select('id, started_at, details')
    .gte('started_at', monthStart)
    .lt('started_at', nextMonth)
    .not('details', 'is', null);

  if (error) throw new Error(`sync_logs 조회 실패: ${error.message}`);
  if (!syncLogs || syncLogs.length === 0) return [];

  // sync_logs에서 퇴원 항목 추출
  type RawDischarge = {
    patientIdNo: string;
    name: string;
    action: 'ward_admission' | 'activity_stop';
    discharge_date: string;
  };

  const dischargeMap = new Map<string, RawDischarge>();

  for (const log of syncLogs) {
    const details = log.details as { changes?: Array<{ patientIdNo: string; name: string; action: string }> } | null;
    if (!details?.changes) continue;

    for (const change of details.changes) {
      let normalizedAction: 'ward_admission' | 'activity_stop';
      if (change.action === 'ward_admission' || change.action === 'activity_stop') {
        normalizedAction = change.action;
      } else if (change.action === 'discharge') {
        normalizedAction = 'activity_stop';
      } else {
        continue;
      }

      const key = `${change.patientIdNo}|${log.started_at}`;
      if (!dischargeMap.has(key)) {
        dischargeMap.set(key, {
          patientIdNo: change.patientIdNo,
          name: change.name,
          action: normalizedAction,
          discharge_date: log.started_at,
        });
      }
    }
  }

  if (dischargeMap.size === 0) return [];

  const dischargeList = Array.from(dischargeMap.values());
  const patientIdNos = [...new Set(dischargeList.map((d) => d.patientIdNo))];

  // patient_id_no로 patients 테이블 LEFT JOIN
  const patientIdMap = new Map<string, string>();

  if (patientIdNos.length > 0) {
    const { data: patients, error: patientError } = await supabase
      .from('patients')
      .select('id, patient_id_no')
      .in('patient_id_no', patientIdNos);

    if (patientError) throw new Error(`환자 조회 실패: ${patientError.message}`);

    for (const patient of patients ?? []) {
      if (patient.patient_id_no) {
        patientIdMap.set(patient.patient_id_no, patient.id);
      }
    }
  }

  return dischargeList.map((d) => ({
    patient_id: patientIdMap.get(d.patientIdNo) ?? null,
    patient_id_no: d.patientIdNo,
    name: d.name,
    discharge_date: d.discharge_date,
    type: d.action,
  }));
}

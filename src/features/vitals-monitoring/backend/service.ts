import type { SupabaseClient } from '@supabase/supabase-js';
import { subMonths, subYears, format } from 'date-fns';
import { classifyBloodPressure, classifyBloodSugar, isAbnormalBP, isAbnormalBS } from '../lib/vitals-utils';
import type { VitalsOverviewItem, PatientVitalsDetail, VitalsRecord, VitalsStats, GetPatientVitalsQuery } from './schema';

function getPeriodStartDate(period: GetPatientVitalsQuery['period']): string {
  const now = new Date();
  const dateMap = {
    '1m': subMonths(now, 1),
    '3m': subMonths(now, 3),
    '6m': subMonths(now, 6),
    '1y': subYears(now, 1),
  } as const;
  return format(dateMap[period], 'yyyy-MM-dd');
}

function computeStats(records: VitalsRecord[]): VitalsStats {
  const systolicValues = records.map(r => r.systolic).filter((v): v is number => v !== null);
  const diastolicValues = records.map(r => r.diastolic).filter((v): v is number => v !== null);
  const bsValues = records.map(r => r.blood_sugar).filter((v): v is number => v !== null);

  const calcMinMaxAvg = (values: number[]) => {
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round(sum / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
    };
  };

  return {
    systolic: calcMinMaxAvg(systolicValues),
    diastolic: calcMinMaxAvg(diastolicValues),
    blood_sugar: calcMinMaxAvg(bsValues),
  };
}

export async function getVitalsOverview(supabase: SupabaseClient): Promise<VitalsOverviewItem[]> {
  const thirtyDaysAgo = format(subMonths(new Date(), 1), 'yyyy-MM-dd');

  const [patientsResult, vitalsResult] = await Promise.all([
    (supabase.from('patients') as any)
      .select('id, name, display_name, room_number, coordinator:staff!patients_coordinator_id_fkey(name)')
      .eq('status', 'active'),
    (supabase.from('vitals') as any)
      .select('patient_id, date, systolic, diastolic, blood_sugar')
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: false }),
  ]);

  const patients: any[] = patientsResult.data || [];
  const vitals: any[] = vitalsResult.data || [];

  // 환자별 최신 vitals 레코드 추출
  const latestByPatient = new Map<string, any>();
  const countByPatient = new Map<string, number>();

  for (const v of vitals) {
    countByPatient.set(v.patient_id, (countByPatient.get(v.patient_id) || 0) + 1);
    if (!latestByPatient.has(v.patient_id)) {
      latestByPatient.set(v.patient_id, v);
    }
  }

  // vitals 데이터가 있는 환자만 매핑
  const result: VitalsOverviewItem[] = [];

  for (const patient of patients) {
    const latest = latestByPatient.get(patient.id);
    if (!latest) continue;

    const hasBP = latest.systolic !== null && latest.diastolic !== null;
    const hasBS = latest.blood_sugar !== null;

    const bpClassification = hasBP ? classifyBloodPressure(latest.systolic, latest.diastolic) : null;
    const bsClassification = hasBS ? classifyBloodSugar(latest.blood_sugar) : null;

    const hasAbnormal =
      (hasBP && isAbnormalBP(latest.systolic, latest.diastolic)) ||
      (hasBS && isAbnormalBS(latest.blood_sugar));

    result.push({
      patient_id: patient.id,
      name: patient.name,
      display_name: patient.display_name,
      room_number: patient.room_number,
      coordinator_name: patient.coordinator?.name || null,
      latest_date: latest.date,
      latest_systolic: latest.systolic,
      latest_diastolic: latest.diastolic,
      latest_blood_sugar: latest.blood_sugar,
      bp_status: bpClassification?.status || null,
      bs_status: bsClassification?.status || null,
      record_count: countByPatient.get(patient.id) || 0,
      has_abnormal: hasAbnormal,
    });
  }

  // 비정상 순으로 정렬 → 이름순
  result.sort((a, b) => {
    if (a.has_abnormal !== b.has_abnormal) return a.has_abnormal ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

export async function getPatientVitalsDetail(
  supabase: SupabaseClient,
  patientId: string,
  period: GetPatientVitalsQuery['period'],
): Promise<PatientVitalsDetail> {
  const startDate = getPeriodStartDate(period);

  const [patientResult, vitalsResult] = await Promise.all([
    (supabase.from('patients') as any)
      .select('id, name, display_name, room_number')
      .eq('id', patientId)
      .single(),
    (supabase.from('vitals') as any)
      .select('date, systolic, diastolic, blood_sugar, memo')
      .eq('patient_id', patientId)
      .gte('date', startDate)
      .order('date', { ascending: true }),
  ]);

  if (!patientResult.data) {
    throw new Error('환자를 찾을 수 없습니다');
  }

  const records: VitalsRecord[] = vitalsResult.data || [];
  const stats = computeStats(records);

  // 최신 레코드에서 상태 분류
  const latestRecord = records.length > 0 ? records[records.length - 1] : null;
  const hasBP = latestRecord?.systolic !== null && latestRecord?.diastolic !== null;
  const hasBS = latestRecord?.blood_sugar !== null;

  return {
    patient: patientResult.data,
    records,
    stats,
    latest_bp_status: hasBP
      ? classifyBloodPressure(latestRecord!.systolic!, latestRecord!.diastolic!).status
      : null,
    latest_bs_status: hasBS
      ? classifyBloodSugar(latestRecord!.blood_sugar!).status
      : null,
  };
}

import { z } from 'zod';

export const getPatientVitalsQuerySchema = z.object({
  period: z.enum(['1m', '3m', '6m', '1y']).default('1m'),
});

export type GetPatientVitalsQuery = z.infer<typeof getPatientVitalsQuerySchema>;

export type VitalsOverviewItem = {
  patient_id: string;
  name: string;
  display_name: string | null;
  room_number: string | null;
  coordinator_name: string | null;
  latest_date: string;
  latest_systolic: number | null;
  latest_diastolic: number | null;
  latest_blood_sugar: number | null;
  bp_status: string | null;
  bs_status: string | null;
  record_count: number;
  has_abnormal: boolean;
};

export type VitalsRecord = {
  date: string;
  systolic: number | null;
  diastolic: number | null;
  blood_sugar: number | null;
  memo: string | null;
};

export type VitalsStats = {
  systolic: { avg: number; min: number; max: number } | null;
  diastolic: { avg: number; min: number; max: number } | null;
  blood_sugar: { avg: number; min: number; max: number } | null;
};

export type PatientVitalsDetail = {
  patient: {
    id: string;
    name: string;
    display_name: string | null;
    room_number: string | null;
  };
  records: VitalsRecord[];
  stats: VitalsStats;
  latest_bp_status: string | null;
  latest_bs_status: string | null;
};

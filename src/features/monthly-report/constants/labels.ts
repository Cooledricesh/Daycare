import type { DischargeEntry } from '../lib/dto';

export const DISCHARGE_TYPE_LABELS: Record<DischargeEntry['type'], string> = {
  ward_admission: '병동 입원',
  activity_stop: '마루 중단',
};

export const SPECIAL_NOTE_TYPE_LABELS: Record<string, string> = {
  holiday: '공휴일',
  outlier: '이상치',
  data_gap: '데이터 누락',
};

export const WEEKDAY_LABELS: Record<string, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
};

export const GENERATED_BY_LABELS: Record<'cron' | 'manual', string> = {
  cron: '자동 생성',
  manual: '수동 생성',
};

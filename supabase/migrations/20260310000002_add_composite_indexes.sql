-- 데이터 페칭 성능 최적화를 위한 복합 인덱스 추가
-- 대부분의 쿼리가 date를 먼저 필터링하므로 (date, patient_id) 순서의 복합 인덱스 추가

-- 쿼리 패턴: .eq('date', date).in('patient_id', patientIds)
CREATE INDEX IF NOT EXISTS idx_attendances_date_patient
  ON attendances(date, patient_id);

CREATE INDEX IF NOT EXISTS idx_consultations_date_patient
  ON consultations(date, patient_id);

CREATE INDEX IF NOT EXISTS idx_vitals_date_patient
  ON vitals(date, patient_id);

-- Partial indexes (WHERE 조건부 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_scheduled_attendances_date_active
  ON scheduled_attendances(date, patient_id) WHERE is_cancelled = false;

CREATE INDEX IF NOT EXISTS idx_consultations_date_has_task
  ON consultations(date, patient_id) WHERE has_task = true;

CREATE INDEX IF NOT EXISTS idx_messages_date_unread
  ON messages(date, patient_id) WHERE is_read = false;

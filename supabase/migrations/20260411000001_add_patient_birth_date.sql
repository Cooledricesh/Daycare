-- Migration: patients.birth_date 컬럼 재추가
-- birth_date는 20241202 마이그레이션에서 DROP 되었으나,
-- 생일 알림/표시 기능을 위해 재도입한다.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN patients.birth_date IS '환자 생년월일 (nullable, 수동 입력, 생일 알림/표시용)';

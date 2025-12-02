-- Migration: patients 테이블 스키마 수정
-- 1. room_number (호실), patient_id_no (병록번호), doctor_id (주치의) 컬럼 추가
-- 2. birth_date 컬럼 삭제

-- 1. 새 컬럼 추가
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS room_number VARCHAR(10),
ADD COLUMN IF NOT EXISTS patient_id_no VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES staff(id);

-- 2. birth_date 컬럼 삭제
ALTER TABLE patients
DROP COLUMN IF EXISTS birth_date;

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_patients_room_number ON patients(room_number);
CREATE INDEX IF NOT EXISTS idx_patients_patient_id_no ON patients(patient_id_no);
CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(doctor_id);

-- 4. 코멘트 추가
COMMENT ON COLUMN patients.room_number IS '환자 소속 반 (호실번호, 3101~3999)';
COMMENT ON COLUMN patients.patient_id_no IS '환자 병록번호 (IDNO, 고유값)';
COMMENT ON COLUMN patients.doctor_id IS '주치의 (staff 테이블 참조)';

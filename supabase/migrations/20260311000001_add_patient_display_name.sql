-- 환자 표시명(display_name) 컬럼 추가
-- 동명이인 구별을 위해 사용자가 임의로 설정하는 프론트엔드 표시용 이름
-- NULL이면 기본 name을 사용

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) DEFAULT NULL;

COMMENT ON COLUMN patients.display_name IS '프론트엔드 표시용 별칭 (동명이인 구별 목적). NULL이면 name 사용';

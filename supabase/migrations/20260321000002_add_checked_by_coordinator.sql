-- 코디네이터 진찰 체크 기능을 위한 컬럼 추가
ALTER TABLE consultations
ADD COLUMN IF NOT EXISTS checked_by_coordinator BOOLEAN DEFAULT false;

COMMENT ON COLUMN consultations.checked_by_coordinator IS '코디네이터가 보완적으로 체크한 진찰 기록 여부 (true=코디 체크, false=의사 직접 진찰)';

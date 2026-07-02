-- clinic_closures 테이블 생성: 휴진일(진찰 없는 날) 관리용
-- holidays(공휴일)와 분리. 휴진일은 출석은 유지, 진찰 지표에서만 제외.
CREATE TABLE IF NOT EXISTS clinic_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  reason VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinic_closures_date ON clinic_closures(date);

DROP TRIGGER IF EXISTS set_clinic_closures_updated_at ON clinic_closures;
CREATE TRIGGER set_clinic_closures_updated_at
  BEFORE UPDATE ON clinic_closures FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clinic_closures DISABLE ROW LEVEL SECURITY;

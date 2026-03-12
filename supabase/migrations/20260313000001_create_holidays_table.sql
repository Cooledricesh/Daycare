-- holidays 테이블 생성: 공휴일 관리용
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  reason VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

CREATE TRIGGER set_holidays_updated_at
  BEFORE UPDATE ON holidays FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE holidays DISABLE ROW LEVEL SECURITY;

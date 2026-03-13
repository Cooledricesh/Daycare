-- ============================================================
-- Migration: suspended 상태 제거 + 알림 확인 테이블 생성
-- ============================================================

-- 1. 기존 suspended 환자를 discharged로 전환
UPDATE patients SET status = 'discharged' WHERE status = 'suspended';

-- 2. CHECK constraint 변경 (active/discharged만 허용)
ALTER TABLE patients DROP CONSTRAINT IF EXISTS chk_patients_status;
ALTER TABLE patients ADD CONSTRAINT chk_patients_status
  CHECK (status IN ('active', 'discharged'));

-- 3. 알림 확인 추적 테이블
CREATE TABLE IF NOT EXISTS notification_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  last_dismissed_sync_id UUID REFERENCES sync_logs(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id)
);

-- RLS 비활성화
ALTER TABLE notification_dismissals DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notification_dismissals_staff
  ON notification_dismissals(staff_id);

-- updated_at 자동 갱신 함수 (존재하지 않을 경우 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 갱신 트리거
CREATE TRIGGER set_notification_dismissals_updated_at
  BEFORE UPDATE ON notification_dismissals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

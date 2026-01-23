-- 환자 동기화 시스템을 위한 테이블 생성
-- 2025-01-22

-- 1. room_coordinator_mapping (호실-담당자 매핑)
CREATE TABLE IF NOT EXISTS room_coordinator_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_prefix VARCHAR(10) UNIQUE NOT NULL,
  coordinator_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  description VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_room_mapping_prefix ON room_coordinator_mapping(room_prefix);
CREATE INDEX IF NOT EXISTS idx_room_mapping_coordinator ON room_coordinator_mapping(coordinator_id);

-- updated_at 트리거
CREATE OR REPLACE TRIGGER trg_room_mapping_updated_at
  BEFORE UPDATE ON room_coordinator_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 초기 데이터 (coordinator_id는 UI에서 매핑)
INSERT INTO room_coordinator_mapping (room_prefix, description) VALUES
  ('3101', '배수현 담당'),
  ('3102', '김세은 담당'),
  ('3103', '안중현 담당'),
  ('3104', '김용덕 담당'),
  ('3105', '조희숙 담당'),
  ('3106', '권은경 담당'),
  ('3111', '박지예 담당'),
  ('3114', '이관수 담당'),
  ('3118', '김세훈 담당')
ON CONFLICT (room_prefix) DO NOTHING;


-- 2. sync_logs (동기화 이력)
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  source VARCHAR(50) NOT NULL,
  triggered_by VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'running',

  total_in_source INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  discharged INTEGER DEFAULT 0,
  reactivated INTEGER DEFAULT 0,
  unchanged INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,

  error_message TEXT,
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);

-- 상태 체크 제약
ALTER TABLE sync_logs DROP CONSTRAINT IF EXISTS chk_sync_logs_source;
ALTER TABLE sync_logs ADD CONSTRAINT chk_sync_logs_source
  CHECK (source IN ('google_sheets', 'excel_upload'));

ALTER TABLE sync_logs DROP CONSTRAINT IF EXISTS chk_sync_logs_status;
ALTER TABLE sync_logs ADD CONSTRAINT chk_sync_logs_status
  CHECK (status IN ('running', 'completed', 'failed'));


-- 3. patients 테이블에 동기화 관련 컬럼 추가 (이미 있으면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE patients ADD COLUMN last_synced_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'sync_source'
  ) THEN
    ALTER TABLE patients ADD COLUMN sync_source VARCHAR(50);
  END IF;
END $$;

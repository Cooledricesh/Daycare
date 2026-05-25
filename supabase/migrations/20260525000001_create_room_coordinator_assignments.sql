-- room_coordinator_assignments: 호실↔코디 N:N 매핑 join table 생성
-- 2026-05-25
--
-- 배경:
--   기존 room_coordinator_mapping.room_prefix UNIQUE 제약으로 한 호실에 한 명의
--   코디만 배정 가능. backup/co 코디 운영 요구로 인해 N:N 모델로 전환.
--
-- 설계 결정 (docs/plans/room-coordinator-n-to-n-plan.md 참고):
--   - patients.coordinator_id 는 primary 캐시로 유지 (denormalized)
--   - 호실당 primary 는 정확히 1명만 (uniq_room_primary partial index)
--   - 만료일/temporal 컬럼은 없음 (is_active 만 사용)
--   - 기존 room_coordinator_mapping 테이블은 drop 하지 않음 (Phase 6 cleanup)

-- 1. room_coordinator_assignments 테이블
CREATE TABLE IF NOT EXISTS room_coordinator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_prefix VARCHAR(10) NOT NULL,
  coordinator_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('primary', 'backup', 'co')),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 동일 호실에 동일 코디가 중복 배정되는 것 방지
  UNIQUE (room_prefix, coordinator_id)
);

-- 2. 호실당 활성 primary 는 정확히 1명만 (DB 레벨 강제)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_room_primary
  ON room_coordinator_assignments (room_prefix)
  WHERE role = 'primary' AND is_active = true;

-- 3. 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_assignments_room
  ON room_coordinator_assignments(room_prefix);

CREATE INDEX IF NOT EXISTS idx_assignments_coordinator
  ON room_coordinator_assignments(coordinator_id);

CREATE INDEX IF NOT EXISTS idx_assignments_role_active
  ON room_coordinator_assignments(role)
  WHERE is_active = true;

-- 4. updated_at 자동 갱신 트리거 (기존 update_updated_at() 함수 재사용)
CREATE OR REPLACE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON room_coordinator_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. 기존 테이블에 DEPRECATED 마크 (Phase 6에서 drop 예정)
COMMENT ON TABLE room_coordinator_mapping IS
  'DEPRECATED: room_coordinator_assignments 로 대체됨. Phase 6 cleanup 에서 drop 예정.';

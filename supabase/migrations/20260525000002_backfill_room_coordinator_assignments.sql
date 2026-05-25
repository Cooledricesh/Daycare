-- room_coordinator_assignments: 기존 1:1 매핑 데이터 backfill
-- 2026-05-25
--
-- 선행 조건:
--   20260525000001_create_room_coordinator_assignments.sql 적용 완료
--
-- 동작:
--   room_coordinator_mapping 의 모든 (coordinator_id IS NOT NULL) row 를
--   room_coordinator_assignments 에 role='primary' 로 복사.
--
-- 검증:
--   아래 SELECT 두 결과가 동일해야 함:
--     SELECT COUNT(*) FROM room_coordinator_mapping WHERE coordinator_id IS NOT NULL;
--     SELECT COUNT(*) FROM room_coordinator_assignments WHERE role = 'primary';

INSERT INTO room_coordinator_assignments
  (room_prefix, coordinator_id, role, is_active, description, display_order)
SELECT
  room_prefix,
  coordinator_id,
  'primary' AS role,
  is_active,
  description,
  0 AS display_order
FROM room_coordinator_mapping
WHERE coordinator_id IS NOT NULL
ON CONFLICT (room_prefix, coordinator_id) DO NOTHING;

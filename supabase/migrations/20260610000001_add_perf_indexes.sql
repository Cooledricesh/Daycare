-- 성능 최적화를 위한 복합 인덱스 추가 (2026-06-10)
--
-- 배경:
--   1. scheduled_patterns: ensureScheduleGenerated가 요일별로 매칭할 때
--      is_active=true 조건과 day_of_week 필터를 함께 사용하므로 복합 partial index 추가.
--      (기존: idx_scheduled_patterns_day(day_of_week) 단일, idx_scheduled_patterns_patient(patient_id) 단일)
--
--   2. room_coordinator_assignments: 보드/직원 화면 매 요청마다 role + room_prefix 조합으로 조회.
--      (기존: idx_assignments_role_active(role) WHERE is_active=true 단일 — room_prefix 컬럼 없음)

-- 1. scheduled_patterns: (day_of_week, patient_id) 복합 partial index (활성 레코드만)
CREATE INDEX IF NOT EXISTS idx_scheduled_patterns_active_dow
  ON scheduled_patterns(day_of_week, patient_id)
  WHERE is_active = true;

-- 2. room_coordinator_assignments: (role, room_prefix) 복합 partial index (활성 레코드만)
--    기존 idx_assignments_role_active(role) 단일 인덱스와 별개로 추가
CREATE INDEX IF NOT EXISTS idx_room_assignments_active
  ON room_coordinator_assignments(role, room_prefix)
  WHERE is_active = true;

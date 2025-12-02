-- Migration: 코디네이터 등록 및 환자 담당코디 매핑
-- room_number 기준으로 coordinator_id 업데이트

-- 1. 코디네이터 staff 테이블에 등록
INSERT INTO staff (login_id, password_hash, name, role, is_active)
VALUES
  ('coord_baesh', '$2b$10$defaulthash', '배수현', 'coordinator', true),
  ('coord_kimse', '$2b$10$defaulthash', '김세은', 'coordinator', true),
  ('coord_anjh', '$2b$10$defaulthash', '안중현', 'coordinator', true),
  ('coord_kimyd', '$2b$10$defaulthash', '김용덕', 'coordinator', true),
  ('coord_johs', '$2b$10$defaulthash', '조희숙', 'coordinator', true),
  ('coord_kwonek', '$2b$10$defaulthash', '권은경', 'coordinator', true),
  ('coord_parkjy', '$2b$10$defaulthash', '박지예', 'coordinator', true),
  ('coord_leeks', '$2b$10$defaulthash', '이관수', 'coordinator', true),
  ('coord_kimsh', '$2b$10$defaulthash', '김세훈', 'coordinator', true)
ON CONFLICT (login_id) DO NOTHING;

-- 2. 환자 테이블의 coordinator_id를 room_number 기준으로 업데이트
UPDATE patients SET coordinator_id = (SELECT id FROM staff WHERE name = '배수현' AND role = 'coordinator' LIMIT 1) WHERE room_number = '3101';
UPDATE patients SET coordinator_id = (SELECT id FROM staff WHERE name = '김세은' AND role = 'coordinator' LIMIT 1) WHERE room_number = '3102';
UPDATE patients SET coordinator_id = (SELECT id FROM staff WHERE name = '안중현' AND role = 'coordinator' LIMIT 1) WHERE room_number = '3103';
UPDATE patients SET coordinator_id = (SELECT id FROM staff WHERE name = '김용덕' AND role = 'coordinator' LIMIT 1) WHERE room_number = '3104';
UPDATE patients SET coordinator_id = (SELECT id FROM staff WHERE name = '조희숙' AND role = 'coordinator' LIMIT 1) WHERE room_number = '3105';
UPDATE patients SET coordinator_id = (SELECT id FROM staff WHERE name = '권은경' AND role = 'coordinator' LIMIT 1) WHERE room_number = '3106';
UPDATE patients SET coordinator_id = (SELECT id FROM staff WHERE name = '박지예' AND role = 'coordinator' LIMIT 1) WHERE room_number = '3111';
UPDATE patients SET coordinator_id = (SELECT id FROM staff WHERE name = '이관수' AND role = 'coordinator' LIMIT 1) WHERE room_number = '3114';
UPDATE patients SET coordinator_id = (SELECT id FROM staff WHERE name = '김세훈' AND role = 'coordinator' LIMIT 1) WHERE room_number = '3118';

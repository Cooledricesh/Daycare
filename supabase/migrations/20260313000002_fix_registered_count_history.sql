-- daily_stats의 registered_count를 동기화 로그 기반 실제 값으로 복원
-- 동기화 로그의 '처리' 항목이 해당 시점의 등록환자 수에 해당

UPDATE daily_stats SET registered_count = 270 WHERE date = '2026-03-03';
UPDATE daily_stats SET registered_count = 269 WHERE date = '2026-03-04';
UPDATE daily_stats SET registered_count = 268 WHERE date = '2026-03-05';
UPDATE daily_stats SET registered_count = 265 WHERE date = '2026-03-06';
UPDATE daily_stats SET registered_count = 263 WHERE date = '2026-03-07';
UPDATE daily_stats SET registered_count = 263 WHERE date = '2026-03-08';
UPDATE daily_stats SET registered_count = 263 WHERE date = '2026-03-09';
UPDATE daily_stats SET registered_count = 262 WHERE date = '2026-03-10';

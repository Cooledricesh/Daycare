-- daily_stats 테이블에 등록환자 수 및 실출석 대비 진찰률 컬럼 추가
ALTER TABLE daily_stats
  ADD COLUMN IF NOT EXISTS registered_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consultation_rate_vs_attendance DECIMAL(5,2);

COMMENT ON COLUMN daily_stats.registered_count IS '해당 날짜의 active 등록환자 수';
COMMENT ON COLUMN daily_stats.consultation_rate_vs_attendance IS '실 출석 대비 진찰률 (consultation/attendance * 100)';

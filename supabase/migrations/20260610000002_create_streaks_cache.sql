-- streaks_cache 테이블: getStreaksMap 계산 결과를 날짜별로 캐싱하여 TTL 5분 동안 재사용
--
-- 배경:
--   getStreaksMap은 요청마다 60일×4테이블을 페이지 순회로 풀스캔한다.
--   출석보드(30초 폴링)와 4개 직역 대시보드가 모두 이 함수를 호출하므로,
--   계산 결과를 이 테이블에 upsert하고 TTL(5분) 이내 재사용하면
--   대부분의 요청에서 17회 DB 왕복을 단 1회로 줄일 수 있다.
--
-- payload 구조:
--   { [patient_id: string]: { attendance_streak: number, consultation_streak: number, streak_tier: string } }

CREATE TABLE IF NOT EXISTS streaks_cache (
  cache_date   DATE PRIMARY KEY,
  payload      JSONB        NOT NULL,
  computed_at  TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_streaks_cache_updated_at ON streaks_cache;
CREATE TRIGGER set_streaks_cache_updated_at
  BEFORE UPDATE ON streaks_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE streaks_cache DISABLE ROW LEVEL SECURITY;

-- Monthly Reports Table
-- 월간 출석/진찰 성과 리포트 스냅샷 저장

BEGIN;

CREATE TABLE IF NOT EXISTS monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- 핵심 지표
  total_attendance_days INTEGER NOT NULL DEFAULT 0,
  per_patient_avg_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  daily_avg_attendance NUMERIC(5,2) NOT NULL DEFAULT 0,
  consultation_attendance_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  registered_count_eom INTEGER NOT NULL DEFAULT 0,
  new_patient_count INTEGER NOT NULL DEFAULT 0,
  discharged_count INTEGER NOT NULL DEFAULT 0,

  -- 상세 데이터 (JSONB)
  weekly_trend JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekday_avg JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_month_comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
  coordinator_performance JSONB NOT NULL DEFAULT '[]'::jsonb,
  patient_segments JSONB NOT NULL DEFAULT '{}'::jsonb,
  consultation_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  special_notes JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- 액션 아이템 (관리자 편집 가능)
  action_items TEXT NOT NULL DEFAULT '',

  -- 메타데이터
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by VARCHAR(20) NOT NULL DEFAULT 'cron',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_year_month ON monthly_reports(year DESC, month DESC);

ALTER TABLE monthly_reports DISABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_monthly_reports_updated_at
  BEFORE UPDATE ON monthly_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;

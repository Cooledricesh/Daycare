-- 환자 프로필 사진 URL 컬럼 추가
ALTER TABLE patients ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 프로필 사진 Storage 버킷 생성 (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-avatars', 'patient-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- NAS variant: patient avatar objects are served by the Daycare NAS gateway,
-- not Supabase Storage. The application table keeps the public object URL.
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN patients.avatar_url IS
  'Public URL of the patient avatar served by the Daycare object gateway';

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Staff Table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE staff 
ADD CONSTRAINT chk_staff_role 
CHECK (role IN ('doctor', 'coordinator', 'nurse', 'admin'));

CREATE INDEX idx_staff_login_id ON staff(login_id);
CREATE INDEX idx_staff_role ON staff(role);

-- 2. Patients Table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  birth_date DATE,
  gender VARCHAR(10),
  coordinator_id UUID REFERENCES staff(id),
  status VARCHAR(20) DEFAULT 'active',
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE patients
ADD CONSTRAINT chk_patients_gender
CHECK (gender IN ('M', 'F'));

ALTER TABLE patients
ADD CONSTRAINT chk_patients_status
CHECK (status IN ('active', 'discharged', 'suspended'));

CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_coordinator ON patients(coordinator_id);
CREATE INDEX idx_patients_status ON patients(status);

-- 3. Scheduled Patterns Table
CREATE TABLE scheduled_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(patient_id, day_of_week)
);

ALTER TABLE scheduled_patterns
ADD CONSTRAINT chk_day_of_week
CHECK (day_of_week BETWEEN 0 AND 6);

CREATE INDEX idx_scheduled_patterns_patient ON scheduled_patterns(patient_id);
CREATE INDEX idx_scheduled_patterns_day ON scheduled_patterns(day_of_week);

-- 4. Scheduled Attendances Table
CREATE TABLE scheduled_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source VARCHAR(20) DEFAULT 'auto',
  is_cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(patient_id, date)
);

ALTER TABLE scheduled_attendances
ADD CONSTRAINT chk_source
CHECK (source IN ('auto', 'manual'));

CREATE INDEX idx_scheduled_attendances_date ON scheduled_attendances(date);
CREATE INDEX idx_scheduled_attendances_patient ON scheduled_attendances(patient_id);

-- 5. Attendances Table
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(patient_id, date)
);

CREATE INDEX idx_attendances_date ON attendances(date);
CREATE INDEX idx_attendances_patient ON attendances(patient_id);

-- 6. Vitals Table
CREATE TABLE vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  systolic INTEGER,
  diastolic INTEGER,
  blood_sugar INTEGER,
  memo TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(patient_id, date)
);

CREATE INDEX idx_vitals_date ON vitals(date);
CREATE INDEX idx_vitals_patient ON vitals(patient_id);

-- 7. Consultations Table
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  doctor_id UUID NOT NULL REFERENCES staff(id),
  note TEXT,
  has_task BOOLEAN DEFAULT false,
  task_content TEXT,
  task_target VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(patient_id, date)
);

ALTER TABLE consultations
ADD CONSTRAINT chk_task_target
CHECK (task_target IS NULL OR task_target IN ('coordinator', 'nurse', 'both'));

CREATE INDEX idx_consultations_date ON consultations(date);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_consultations_doctor ON consultations(doctor_id);
CREATE INDEX idx_consultations_has_task ON consultations(has_task) WHERE has_task = true;

-- 8. Task Completions Table
CREATE TABLE task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES staff(id),
  role VARCHAR(20) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE task_completions
ADD CONSTRAINT chk_completion_role
CHECK (role IN ('coordinator', 'nurse'));

CREATE INDEX idx_task_completions_consultation ON task_completions(consultation_id);
CREATE INDEX idx_task_completions_staff ON task_completions(completed_by);
CREATE INDEX idx_task_completions_incomplete ON task_completions(is_completed) WHERE is_completed = false;

-- 9. Messages Table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  author_id UUID NOT NULL REFERENCES staff(id),
  author_role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE messages
ADD CONSTRAINT chk_author_role
CHECK (author_role IN ('coordinator', 'nurse'));

CREATE INDEX idx_messages_patient_date ON messages(patient_id, date);
CREATE INDEX idx_messages_date ON messages(date);
CREATE INDEX idx_messages_unread ON messages(is_read) WHERE is_read = false;

-- 10. Daily Stats Table
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  scheduled_count INTEGER DEFAULT 0,
  attendance_count INTEGER DEFAULT 0,
  consultation_count INTEGER DEFAULT 0,
  attendance_rate DECIMAL(5,2),
  consultation_rate DECIMAL(5,2),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_daily_stats_date ON daily_stats(date);

-- 11. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

# 낮병원 환자 관리 앱 PRD

## 1. 프로젝트 개요

### 1.1 배경 및 목적

낮병원에서 환자 출석 관리, 진찰 기록, 직원-의사 간 커뮤니케이션을 효율화하기 위한 웹 애플리케이션 개발

### 1.2 현재 문제점

| 문제 영역 | 상세 내용 |
|----------|----------|
| 출석 관리 | 환자 출석을 체크하는 전용 시스템 없음. 직원들이 일일이 확인 |
| 활력징후 기록 | 환자가 직접 측정 가능한 항목도 직원이 매번 물어보고 수기 기록 |
| 진찰 참석 확인 | 의사는 구글 스프레드시트에 기록하지만 직원들은 모바일 UI 불편 + 담당 환자 필터링 불가로 활용하지 못함 |
| 이전 기록 조회 | 매일 새 시트 생성 구조라 특정 환자의 히스토리 조회 어려움 |
| 시스템 연동 | 기존 EMR이 오래되어 API 연동 불가, 스프레드시트 기록이 의무기록과 별개로 존재 |

### 1.3 운영 환경

| 항목 | 내용 |
|------|------|
| 환자 수 | 약 250명 |
| 직원 수 | 10~20명 |
| 의사 수 | 5명 |
| 일일 출석 | 매일 다름 (전체 중 일부만 출석 예정) |
| 진찰 속도 | 환자당 10초~180초 |

---

## 2. 사용자 역할 및 요구사항

### 2.1 사용자 역할 정의

| 역할 | 주요 기능 | 접근 환경 |
|------|----------|----------|
| 환자 | 출석 체크, 활력징후 입력 | 병원 내 태블릿/데스크탑 |
| 담당 코디 (사회복지사) | 담당 환자 관리, 의사에게 전달사항 작성, 지시사항 확인 | 개인 모바일 (반응형 웹) |
| 낮병동 간호사 | 전체 환자 처방 변경 확인, 의사에게 전달사항 작성 | 개인 모바일 (반응형 웹) |
| 의사 | 진찰 기록, 처방 지시, 전달사항 확인 | 데스크탑 |
| 관리자 | 환자-담당자 매칭, 스케줄 관리, 계정 관리 | 데스크탑 |

### 2.2 핵심 기능 흐름

```
[진찰 전]
담당 코디/간호사 → 환자별 전달사항 작성 → 의사가 진찰 시 확인

[진찰 중]
의사 → 면담 내용 기록 + 처방 지시/변경 기록

[진찰 후]
담당 코디 → 본인 담당 환자의 지시사항 확인
간호사 → 전체 환자 중 약/처방 변경 건 확인 후 조치
```

### 2.3 사용자별 상세 요구사항

#### 환자
- 이름 검색 → 출석 체크 (터치 한두 번으로 완료)
- 혈압, 혈당 등 활력징후 직접 입력 (선택사항)
- **UI 원칙**: 극도로 단순하고 직관적 (인지기능 저하 고려)
- 큰 글씨(24px 이상), 큰 버튼, 2~3단계 이내 완료

#### 담당 코디 (사회복지사)
- 담당 환자만 필터링해서 조회
- 환자별 출석/진찰 상태 실시간 확인
- 의사 지시사항 확인 및 처리 완료 체크
- 의사에게 전달사항 작성 (진찰 전 미리 기재)
- 환자별 히스토리 조회

#### 낮병동 간호사
- 전체 환자 중 오늘 처방/약 변경 건만 필터링
- 처리 완료 체크
- 의사에게 전달사항 작성

#### 의사
- 빠른 환자 검색 (초성 검색 지원)
- 진찰 기록 (면담 내용, 상태, 증상)
- 처리 필요 항목 체크 + 지시 내용 기록
- 지시 대상 지정 (담당코디/간호사/둘다)
- 직원 전달사항 확인
- 환자별 최근 기록 조회 (1개월)
- 처리 필요 항목 일괄 조회/관리
- **키보드 중심 UX** (빠른 진찰 흐름 지원)

#### 관리자
- 직원 계정 관리 (추가, 수정, 비활성화)
- 환자 정보 관리
- 환자-담당코디 매칭
- 기본 출석 스케줄 관리 (요일별 패턴)
- 일일 예정 출석 관리
- 출석률/진찰 참석률 통계 조회

---

## 3. 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Next.js API Routes (또는 Server Actions) |
| Database | Supabase (PostgreSQL) - Auth 기능 미사용, DB만 활용 |
| Hosting | Vercel |
| 인증 | 자체 구현 (bcrypt + JWT + httpOnly 쿠키) |

### 3.1 플랫폼 전략

- **반응형 웹앱 하나로 통일**
- 모바일/태블릿/데스크탑 breakpoint별 UI 최적화
- PWA 설정 (홈 화면 추가) - 선택사항

---

## 4. 인증 설계

### 4.1 환자용: 인증 없음

```
/patient 페이지
    ↓
이름 검색 → 본인 선택 → 출석 체크
```
- 로그인 없음
- 병원 내 기기에서만 접근 (필요시 IP 제한)

### 4.2 직원/의사용: 단순 ID + 비밀번호

```
/login 페이지
    ↓
ID: 직접 부여 (예: hong, kim)
PW: 초기 비밀번호 → 본인이 변경
    ↓
역할(coordinator/nurse/doctor/admin)에 따라 화면 분기
```

- Supabase Auth 사용 안 함
- staff 테이블에 password_hash 저장
- 세션: httpOnly 쿠키 + JWT
- 비밀번호 찾기: 관리자가 초기화 (이메일 발송 없음)

### 4.3 보안 고려사항

| 항목 | 적용 |
|------|------|
| HTTPS | 필수 (Vercel 기본 제공) |
| 비밀번호 해싱 | bcrypt |
| JWT 만료 | 8시간 또는 하루 |
| 환자 페이지 접근 제한 | 필요시 IP 화이트리스트 |

---

## 5. URL 구조

```
/ (랜딩 또는 로그인으로 리다이렉트)

/patient
  - 환자용 출석 체크 (인증 없음)

/login
  - 직원/의사 로그인

/doctor
  /doctor/consultation    - 진찰 화면
  /doctor/tasks           - 처리 필요 항목 목록
  /doctor/history/[id]    - 환자별 히스토리

/staff (담당 코디)
  /staff/dashboard        - 담당 환자 목록
  /staff/patient/[id]     - 환자 상세
  /staff/messages         - 전달사항 작성

/nurse
  /nurse/prescriptions    - 오늘 처방 변경 목록

/admin
  /admin/patients         - 환자 관리
  /admin/staff            - 직원 관리
  /admin/schedule         - 기본 스케줄 관리
  /admin/stats            - 통계 대시보드
```

---

## 6. 데이터베이스 스키마

### 6.1 ERD 개요

```
staff (직원/의사)
  │
  ├─< patients (환자) ─────────────┬─< attendances (출석)
  │       │                        ├─< vitals (활력징후)
  │       │                        ├─< consultations (진찰기록)
  │       │                        │       │
  │       │                        │       └─< task_completions (지시처리)
  │       │                        │
  │       └────────────────────────┴─< messages (전달사항)
  │
  └─< scheduled_patterns (기본 출석 스케줄)

scheduled_attendances (일일 예정 출석) ─> patients

daily_stats (일일 통계) - 별도 집계 테이블
```

### 6.2 테이블 상세

#### staff (직원/의사/관리자)

```sql
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
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| login_id | VARCHAR(50) | 로그인 ID (unique) |
| password_hash | VARCHAR(255) | bcrypt 해시 |
| name | VARCHAR(100) | 이름 |
| role | VARCHAR(20) | 'doctor', 'coordinator', 'nurse', 'admin' |
| is_active | BOOLEAN | 활성 상태 |
| created_at | TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | 수정일시 |

---

#### patients (환자)

```sql
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
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| name | VARCHAR(100) | 환자 이름 |
| birth_date | DATE | 생년월일 |
| gender | VARCHAR(10) | 'M', 'F' |
| coordinator_id | UUID | FK → staff.id (담당 코디) |
| status | VARCHAR(20) | 'active', 'discharged', 'suspended' |
| memo | TEXT | 관리자 메모 |
| created_at | TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | 수정일시 |

---

#### scheduled_patterns (기본 출석 스케줄)

```sql
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
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| patient_id | UUID | FK → patients.id |
| day_of_week | INTEGER | 0=일, 1=월, 2=화, ..., 6=토 |
| is_active | BOOLEAN | 활성 상태 |
| created_at | TIMESTAMP | 생성일시 |

예시: 홍길동 - 월/수/금 출석 → day_of_week: 1, 3, 5 세 개 row

---

#### scheduled_attendances (일일 예정 출석)

```sql
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
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| patient_id | UUID | FK → patients.id |
| date | DATE | 예정 날짜 |
| source | VARCHAR(20) | 'auto' (패턴에서 생성), 'manual' (수동 추가) |
| is_cancelled | BOOLEAN | 예정 취소 여부 |
| created_at | TIMESTAMP | 생성일시 |

---

#### attendances (실제 출석)

```sql
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(patient_id, date)
);

CREATE INDEX idx_attendances_date ON attendances(date);
CREATE INDEX idx_attendances_patient ON attendances(patient_id);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| patient_id | UUID | FK → patients.id |
| date | DATE | 출석 날짜 |
| checked_at | TIMESTAMP | 출석 체크 시각 |

---

#### vitals (활력징후)

```sql
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
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| patient_id | UUID | FK → patients.id |
| date | DATE | 기록 날짜 |
| systolic | INTEGER | 수축기 혈압 |
| diastolic | INTEGER | 이완기 혈압 |
| blood_sugar | INTEGER | 혈당 |
| memo | TEXT | 기타 기록 |
| recorded_at | TIMESTAMP | 기록 시각 |

> 참고: 하루에 여러 번 측정 필요 시 UNIQUE 제약 제거

---

#### consultations (진찰 기록)

```sql
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
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| patient_id | UUID | FK → patients.id |
| date | DATE | 진찰 날짜 |
| doctor_id | UUID | FK → staff.id |
| note | TEXT | 면담 내용, 상태, 증상 |
| has_task | BOOLEAN | 처리 필요 항목 있음 여부 |
| task_content | TEXT | 지시/요청 내용 (자유텍스트) |
| task_target | VARCHAR(20) | 'coordinator', 'nurse', 'both' |
| created_at | TIMESTAMP | 생성일시 |
| updated_at | TIMESTAMP | 수정일시 |

---

#### task_completions (지시 처리 기록)

```sql
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
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| consultation_id | UUID | FK → consultations.id |
| completed_by | UUID | FK → staff.id (처리한 직원) |
| role | VARCHAR(20) | 'coordinator', 'nurse' |
| is_completed | BOOLEAN | 처리 완료 여부 |
| completed_at | TIMESTAMP | 처리 완료 시각 |
| memo | TEXT | 처리 메모 |
| created_at | TIMESTAMP | 생성일시 |

> 참고: task_target이 'both'인 경우 coordinator, nurse 각각 row 생성

---

#### messages (전달사항 - 직원 → 의사)

```sql
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
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| patient_id | UUID | FK → patients.id |
| date | DATE | 해당 진찰일 |
| author_id | UUID | FK → staff.id (작성자) |
| author_role | VARCHAR(20) | 'coordinator', 'nurse' |
| content | TEXT | 전달 내용 |
| is_read | BOOLEAN | 의사 확인 여부 |
| read_at | TIMESTAMP | 확인 시각 |
| created_at | TIMESTAMP | 작성 시각 |

---

#### daily_stats (일일 통계)

```sql
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
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| date | DATE | 날짜 (unique) |
| scheduled_count | INTEGER | 예정 인원 수 |
| attendance_count | INTEGER | 실제 출석 수 |
| consultation_count | INTEGER | 진찰 참석 수 |
| attendance_rate | DECIMAL(5,2) | 출석률 % |
| consultation_rate | DECIMAL(5,2) | 진찰 참석률 % |
| calculated_at | TIMESTAMP | 집계 시각 |

---

### 6.3 보조 함수 및 트리거

#### updated_at 자동 갱신

```sql
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
```

#### 일일 예정 출석 자동 생성 (매일 실행 - Supabase Edge Function 또는 cron)

```sql
INSERT INTO scheduled_attendances (patient_id, date, source)
SELECT 
  sp.patient_id,
  CURRENT_DATE,
  'auto'
FROM scheduled_patterns sp
JOIN patients p ON p.id = sp.patient_id
WHERE sp.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)
  AND sp.is_active = true
  AND p.status = 'active'
ON CONFLICT (patient_id, date) DO NOTHING;
```

---

### 6.4 주요 쿼리 예시

#### 오늘 출석 예정 + 실제 출석 + 진찰 여부 조회 (의사용)

```sql
SELECT 
  p.id,
  p.name,
  p.gender,
  p.birth_date,
  s.name AS coordinator_name,
  CASE WHEN a.id IS NOT NULL THEN true ELSE false END AS is_attended,
  a.checked_at,
  CASE WHEN c.id IS NOT NULL THEN true ELSE false END AS is_consulted,
  c.has_task,
  (SELECT COUNT(*) FROM messages m 
   WHERE m.patient_id = p.id 
   AND m.date = CURRENT_DATE 
   AND m.is_read = false) AS unread_message_count
FROM scheduled_attendances sa
JOIN patients p ON p.id = sa.patient_id
LEFT JOIN staff s ON s.id = p.coordinator_id
LEFT JOIN attendances a ON a.patient_id = p.id AND a.date = CURRENT_DATE
LEFT JOIN consultations c ON c.patient_id = p.id AND c.date = CURRENT_DATE
WHERE sa.date = CURRENT_DATE
  AND sa.is_cancelled = false
ORDER BY p.name;
```

#### 담당 코디 기준 환자 목록

```sql
SELECT 
  p.*,
  a.checked_at AS attendance_time,
  c.id AS consultation_id,
  c.has_task,
  c.task_content,
  COALESCE(
    (SELECT bool_and(tc.is_completed) 
     FROM task_completions tc 
     WHERE tc.consultation_id = c.id 
     AND tc.role = 'coordinator'),
    true
  ) AS task_completed
FROM patients p
LEFT JOIN attendances a ON a.patient_id = p.id AND a.date = CURRENT_DATE
LEFT JOIN consultations c ON c.patient_id = p.id AND c.date = CURRENT_DATE
WHERE p.coordinator_id = :coordinator_id
  AND p.status = 'active'
ORDER BY p.name;
```

#### 오늘 처방 변경 건 (간호사용)

```sql
SELECT 
  c.*,
  p.name AS patient_name,
  s.name AS coordinator_name,
  d.name AS doctor_name,
  tc.is_completed,
  tc.completed_at
FROM consultations c
JOIN patients p ON p.id = c.patient_id
LEFT JOIN staff s ON s.id = p.coordinator_id
JOIN staff d ON d.id = c.doctor_id
LEFT JOIN task_completions tc ON tc.consultation_id = c.id AND tc.role = 'nurse'
WHERE c.date = CURRENT_DATE
  AND c.has_task = true
  AND c.task_target IN ('nurse', 'both')
ORDER BY c.created_at;
```

#### 환자별 최근 1개월 히스토리

```sql
SELECT 
  c.date,
  c.note,
  c.has_task,
  c.task_content,
  d.name AS doctor_name
FROM consultations c
JOIN staff d ON d.id = c.doctor_id
WHERE c.patient_id = :patient_id
  AND c.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY c.date DESC;
```

#### 일일 통계 집계

```sql
INSERT INTO daily_stats (date, scheduled_count, attendance_count, consultation_count, attendance_rate, consultation_rate)
SELECT 
  CURRENT_DATE,
  (SELECT COUNT(*) FROM scheduled_attendances WHERE date = CURRENT_DATE AND is_cancelled = false),
  (SELECT COUNT(*) FROM attendances WHERE date = CURRENT_DATE),
  (SELECT COUNT(*) FROM consultations WHERE date = CURRENT_DATE),
  CASE 
    WHEN (SELECT COUNT(*) FROM scheduled_attendances WHERE date = CURRENT_DATE AND is_cancelled = false) > 0 
    THEN ROUND(
      (SELECT COUNT(*) FROM attendances WHERE date = CURRENT_DATE)::DECIMAL / 
      (SELECT COUNT(*) FROM scheduled_attendances WHERE date = CURRENT_DATE AND is_cancelled = false) * 100, 2
    )
    ELSE 0 
  END,
  CASE 
    WHEN (SELECT COUNT(*) FROM attendances WHERE date = CURRENT_DATE) > 0 
    THEN ROUND(
      (SELECT COUNT(*) FROM consultations WHERE date = CURRENT_DATE)::DECIMAL / 
      (SELECT COUNT(*) FROM attendances WHERE date = CURRENT_DATE) * 100, 2
    )
    ELSE 0 
  END
ON CONFLICT (date) DO UPDATE SET
  scheduled_count = EXCLUDED.scheduled_count,
  attendance_count = EXCLUDED.attendance_count,
  consultation_count = EXCLUDED.consultation_count,
  attendance_rate = EXCLUDED.attendance_rate,
  consultation_rate = EXCLUDED.consultation_rate,
  calculated_at = NOW();
```

---

## 7. 화면 와이어프레임

### 7.1 환자용 화면 (태블릿/데스크탑)

#### 출석 체크 - 메인

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                    오늘 출석 체크                            │
│                                                             │
│                    2024년 11월 28일 목요일                   │
│                                                             │
│         ┌─────────────────────────────────────┐             │
│         │                                     │             │
│         │       이름을 입력하세요              │             │
│         │                                     │             │
│         └─────────────────────────────────────┘             │
│                                                             │
│              홍길동                                          │
│              홍영희                                          │
│              홍수민                                          │
│                    (자동완성 목록)                           │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

- 글씨 크기: 최소 24px 이상
- 입력창: 높이 60px 이상
- 자동완성 항목: 높이 50px 이상
```

#### 출석 체크 - 확인

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                      홍길동 님                               │
│                                                             │
│                   출석하시겠습니까?                          │
│                                                             │
│                                                             │
│       ┌───────────────┐       ┌───────────────┐            │
│       │               │       │               │            │
│       │     아니오     │       │      예       │            │
│       │               │       │   (primary)   │            │
│       └───────────────┘       └───────────────┘            │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 출석 완료 + 활력징후 입력

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                      ✓ 출석 완료!                           │
│                                                             │
│                      홍길동 님                               │
│                      09:32 출석                             │
│                                                             │
│          ─────────────────────────────────────              │
│                                                             │
│                  혈압/혈당을 입력하세요                       │
│                      (선택사항)                              │
│                                                             │
│            혈압    ┌──────┐   /   ┌──────┐                 │
│                    │ 120  │       │  80  │   mmHg          │
│                    └──────┘       └──────┘                 │
│                    (수축기)       (이완기)                   │
│                                                             │
│            혈당    ┌──────────┐                             │
│                    │   105    │   mg/dL                    │
│                    └──────────┘                             │
│                                                             │
│       ┌───────────────┐       ┌───────────────┐            │
│       │   건너뛰기     │       │     저장      │            │
│       └───────────────┘       └───────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 최종 완료

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                         ✓                                  │
│                                                             │
│                   홍길동 님                                  │
│                                                             │
│                 오늘도 좋은 하루 되세요!                      │
│                                                             │
│                                                             │
│              (5초 후 자동으로 처음 화면으로)                  │
│                                                             │
│              ┌─────────────────────┐                        │
│              │     처음으로        │                        │
│              └─────────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 7.2 로그인 화면

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                    낮병원 환자관리                           │
│                                                             │
│                                                             │
│              ┌─────────────────────────────┐                │
│              │ 아이디                       │                │
│              └─────────────────────────────┘                │
│                                                             │
│              ┌─────────────────────────────┐                │
│              │ 비밀번호                     │                │
│              └─────────────────────────────┘                │
│                                                             │
│              ┌─────────────────────────────┐                │
│              │          로그인             │                │
│              └─────────────────────────────┘                │
│                                                             │
│              비밀번호를 잊으셨나요?                          │
│              → 관리자에게 문의하세요                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 7.3 의사용 화면 (데스크탑)

#### 진찰 메인 - 환자 미선택

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  낮병원 관리    [진찰] [처리필요 (3)] [설정]              홍의사 ▼  로그아웃     │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ 🔍 환자 검색 (이름/초성)                                           Ctrl+K  ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────┐  ┌────────────────────────────────────────────────────┐│
│  │                     │  │                                                    ││
│  │  오늘 출석 (20명)   │  │  환자를 선택하세요                                 ││
│  │                     │  │                                                    ││
│  │  ┌───────────────┐  │  │                                                    ││
│  │  │ ⏳ 홍길동 💬  │  │  │                                                    ││
│  │  ├───────────────┤  │  │                                                    ││
│  │  │ ⏳ 김영희     │  │  │                                                    ││
│  │  ├───────────────┤  │  │                                                    ││
│  │  │ ✓ 박철수     │  │  │                                                    ││
│  │  ├───────────────┤  │  │                                                    ││
│  │  │ ⏳ 이민수 💬  │  │  │                                                    ││
│  │  ├───────────────┤  │  │                                                    ││
│  │  │ ✓ 정수진 🔔  │  │  │                                                    ││
│  │  └───────────────┘  │  │                                                    ││
│  │                     │  │                                                    ││
│  │  ───────────────    │  │                                                    ││
│  │  ⏳ 대기: 12명      │  │                                                    ││
│  │  ✓ 완료: 8명       │  │                                                    ││
│  │                     │  │                                                    ││
│  └─────────────────────┘  └────────────────────────────────────────────────────┘│
│                                                                                  │
│  💬 전달사항 있음   🔔 처리필요   ⏳ 대기   ✓ 완료                              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### 진찰 메인 - 환자 선택됨

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  낮병원 관리    [진찰] [처리필요 (3)] [설정]              홍의사 ▼  로그아웃     │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ 🔍 환자 검색 (이름/초성)                                           Ctrl+K  ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────┐  ┌────────────────────────────────────────────────────┐│
│  │                     │  │                                                    ││
│  │  오늘 출석 (20명)   │  │  홍길동 (52세, M)                    담당: 김코디  ││
│  │                     │  │                                                    ││
│  │  ┌───────────────┐  │  │  ┌──────────────────────────────────────────────┐ ││
│  │  │ ⏳ 홍길동 💬 ◀│  │  │  │ 💬 직원 전달사항                            │ ││
│  │  ├───────────────┤  │  │  │                                              │ ││
│  │  │ ⏳ 김영희     │  │  │  │ [김코디 09:30]                               │ ││
│  │  ├───────────────┤  │  │  │ 어제 저녁 불면 심해 전화 옴.                 │ ││
│  │  │ ✓ 박철수     │  │  │  │ 수면제 증량 검토 요청드립니다.               │ ││
│  │  ├───────────────┤  │  │  │                                              │ ││
│  │  │ ⏳ 이민수 💬  │  │  │  └──────────────────────────────────────────────┘ ││
│  │  ├───────────────┤  │  │                                                    ││
│  │  │ ✓ 정수진 🔔  │  │  │  면담 내용                                        ││
│  │  └───────────────┘  │  │  ┌──────────────────────────────────────────────┐ ││
│  │                     │  │  │                                              │ ││
│  │  ───────────────    │  │  │                                              │ ││
│  │  ⏳ 대기: 12명      │  │  │                                              │ ││
│  │  ✓ 완료: 8명       │  │  │ (넓은 텍스트 입력 영역)                       │ ││
│  │                     │  │  │                                              │ ││
│  │                     │  │  │                                              │ ││
│  │                     │  │  └──────────────────────────────────────────────┘ ││
│  │                     │  │                                                    ││
│  │                     │  │  ☐ 처리 필요 항목 있음                            ││
│  │                     │  │                                                    ││
│  │                     │  │  ▼ 최근 기록 (1개월)                              ││
│  │                     │  │  ┌──────────────────────────────────────────────┐ ││
│  │                     │  │  │ 11/27  수면 다소 호전, 낮 활동량 증가        │ ││
│  │                     │  │  │ 11/26  불면 지속, 낮 졸림 호소               │ ││
│  │                     │  │  │ 11/25  ...                                   │ ││
│  │                     │  │  └──────────────────────────────────────────────┘ ││
│  │                     │  │                                                    ││
│  │                     │  │  ┌─────────────────────────────────────────────┐  ││
│  │                     │  │  │            진찰 완료 (Enter)                │  ││
│  │                     │  │  └─────────────────────────────────────────────┘  ││
│  └─────────────────────┘  └────────────────────────────────────────────────────┘│
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### 처리 필요 체크 시 확장 영역

```
│  │  ☑ 처리 필요 항목 있음                            ││
│  │                                                    ││
│  │  지시 대상:  ◉ 담당코디  ○ 간호사  ○ 둘다        ││
│  │                                                    ││
│  │  지시 내용                                         ││
│  │  ┌──────────────────────────────────────────────┐ ││
│  │  │ 졸피뎀 10mg → 15mg 증량                      │ ││
│  │  └──────────────────────────────────────────────┘ ││
```

#### 처리 필요 목록 화면

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  낮병원 관리    [진찰] [처리필요 (3)] [설정]              홍의사 ▼  로그아웃     │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  처리 필요 항목                                                    2024.11.28   │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  환자       │ 지시 내용                  │ 대상     │ 상태      │ 처리    │ │
│  ├─────────────┼────────────────────────────┼──────────┼───────────┼─────────┤ │
│  │  홍길동     │ 졸피뎀 10→15mg 증량        │ 간호사   │ 미처리    │ [완료]  │ │
│  ├─────────────┼────────────────────────────┼──────────┼───────────┼─────────┤ │
│  │  김영희     │ 진단서 발급                │ 담당코디 │ 미처리    │ [완료]  │ │
│  ├─────────────┼────────────────────────────┼──────────┼───────────┼─────────┤ │
│  │  박철수     │ 다음주 외래 예약           │ 담당코디 │ 처리완료 ✓│         │ │
│  └─────────────┴────────────────────────────┴──────────┴───────────┴─────────┘ │
│                                                                                  │
│  ○ 전체  ◉ 미처리만  ○ 처리완료                                               │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 7.4 담당 코디용 화면 (모바일)

#### 대시보드

```
┌─────────────────────────────┐
│  낮병원        ≡  김코디 ▼  │
├─────────────────────────────┤
│                             │
│  2024.11.28 목요일          │
│                             │
│  내 담당 환자 (15명)        │
│  ┌───────────────────────┐  │
│  │ 출석 12 │ 진찰 8 │ 🔔 2│  │
│  └───────────────────────┘  │
│                             │
│  ┌─────────────────────────┐│
│  │ 🔔 홍길동               ││
│  │ 출석 ✓  진찰 ✓         ││
│  │ 지시: 졸피뎀 증량       ││
│  │                  [상세] ││
│  ├─────────────────────────┤│
│  │ 김영희                  ││
│  │ 출석 ✓  진찰 ✓         ││
│  │ 지시: -                 ││
│  │                  [상세] ││
│  ├─────────────────────────┤│
│  │ 박철수                  ││
│  │ 출석 ✓  진찰 ⏳         ││
│  │                  [상세] ││
│  ├─────────────────────────┤│
│  │ ⚠️ 이민수               ││
│  │ 출석 ✗  (결석)          ││
│  │                  [상세] ││
│  └─────────────────────────┘│
│                             │
│  [+ 전달사항 작성]          │
│                             │
└─────────────────────────────┘
```

#### 환자 상세

```
┌─────────────────────────────┐
│  ← 뒤로       홍길동        │
├─────────────────────────────┤
│                             │
│  홍길동 (52세, M)           │
│                             │
│  ───────────────────────    │
│  오늘 상태                  │
│  ───────────────────────    │
│  출석: ✓ 09:32              │
│  진찰: ✓ 10:15              │
│  혈압: 125/82               │
│                             │
│  ───────────────────────    │
│  🔔 지시사항                │
│  ───────────────────────    │
│  졸피뎀 10mg → 15mg 증량    │
│                             │
│  ┌─────────────────────────┐│
│  │      처리 완료 체크      ││
│  └─────────────────────────┘│
│                             │
│  ───────────────────────    │
│  의사에게 전달사항          │
│  ───────────────────────    │
│  ┌─────────────────────────┐│
│  │                         ││
│  │ 내용 입력...            ││
│  │                         ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │         전송            ││
│  └─────────────────────────┘│
│                             │
│  ───────────────────────    │
│  최근 기록                  │
│  ───────────────────────    │
│  ▼ 11/27 - 수면 호전...     │
│  ▼ 11/26 - 불면 지속...     │
│                             │
└─────────────────────────────┘
```

---

### 7.5 간호사용 화면 (모바일)

```
┌─────────────────────────────┐
│  낮병원        ≡  박간호 ▼  │
├─────────────────────────────┤
│                             │
│  2024.11.28 목요일          │
│                             │
│  오늘 처방 변경 (5건)       │
│                             │
│  ○ 전체  ◉ 미처리  ○ 완료  │
│                             │
│  ┌─────────────────────────┐│
│  │ 홍길동                  ││
│  │ 담당: 김코디            ││
│  │ 졸피뎀 10→15mg 증량     ││
│  │                         ││
│  │ ☐ 처리 완료      [상세] ││
│  ├─────────────────────────┤│
│  │ 박철수                  ││
│  │ 담당: 이코디            ││
│  │ 수액 처방               ││
│  │                         ││
│  │ ☐ 처리 완료      [상세] ││
│  ├─────────────────────────┤│
│  │ 정수진                  ││
│  │ 담당: 김코디            ││
│  │ 혈압약 추가             ││
│  │                         ││
│  │ ☑ 처리 완료 ✓    [상세] ││
│  └─────────────────────────┘│
│                             │
│  [+ 전달사항 작성]          │
│                             │
└─────────────────────────────┘
```

---

### 7.6 관리자 화면 (데스크탑)

#### 환자 관리

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  낮병원 관리                                              관리자 ▼  로그아웃    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  [직원관리] [환자관리] [스케줄관리] [통계]                                        │
│                                                                                  │
│  환자 관리                                              [+ 환자 추가]            │
│                                                                                  │
│  🔍 검색: [________________]     상태: [전체 ▼]    담당: [전체 ▼]               │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  이름    │ 생년월일   │ 담당 코디  │ 출석 패턴      │ 상태   │ 관리        ││
│  ├──────────┼────────────┼────────────┼────────────────┼────────┼─────────────┤│
│  │  홍길동  │ 1972.03.15 │ 김코디     │ 월,수,금       │ 활성   │ [수정]      ││
│  ├──────────┼────────────┼────────────┼────────────────┼────────┼─────────────┤│
│  │  김영희  │ 1985.07.22 │ 김코디     │ 월,화,수,목,금 │ 활성   │ [수정]      ││
│  ├──────────┼────────────┼────────────┼────────────────┼────────┼─────────────┤│
│  │  박철수  │ 1990.11.08 │ 이코디     │ 화,목          │ 활성   │ [수정]      ││
│  └──────────┴────────────┴────────────┴────────────────┴────────┴─────────────┘│
│                                                                                  │
│  < 1 2 3 4 5 >                                                                   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### 환자 추가/수정 모달

```
┌───────────────────────────────────────────┐
│  환자 추가                           [X]  │
├───────────────────────────────────────────┤
│                                           │
│  이름 *                                   │
│  ┌─────────────────────────────────────┐  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  생년월일                                 │
│  ┌─────────────────────────────────────┐  │
│  │ 1990-01-01                          │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  성별                                     │
│  ◉ 남  ○ 여                              │
│                                           │
│  담당 코디                                │
│  ┌─────────────────────────────────────┐  │
│  │ 김코디                           ▼  │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  출석 패턴                                │
│  ☑ 월  ☑ 화  ☑ 수  ☑ 목  ☑ 금          │
│                                           │
│  메모                                     │
│  ┌─────────────────────────────────────┐  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  ┌─────────────┐  ┌─────────────────────┐ │
│  │    취소     │  │        저장        │ │
│  └─────────────┘  └─────────────────────┘ │
└───────────────────────────────────────────┘
```

#### 통계 대시보드

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  낮병원 관리                                              관리자 ▼  로그아웃    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  [직원관리] [환자관리] [스케줄관리] [통계]                                        │
│                                                                                  │
│  통계                                기간: [2024.11.01] ~ [2024.11.28]           │
│                                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐   │
│  │                      │  │                      │  │                      │   │
│  │  평균 출석률         │  │  평균 진찰 참석률    │  │  오늘 출석           │   │
│  │                      │  │                      │  │                      │   │
│  │      87.3%          │  │       94.2%          │  │    18/22명           │   │
│  │                      │  │                      │  │                      │   │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘   │
│                                                                                  │
│  일별 출석률 추이                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                             ││
│  │  100% ─┬─────────────────────────────────────────────────────────────       ││
│  │        │      ●   ●       ●   ●       ●                                     ││
│  │   80% ─┼──●─────────●─────────────●──────●───────────────────────────       ││
│  │        │                                                                    ││
│  │   60% ─┼─────────────────────────────────────────────────────────────       ││
│  │        └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴──→            ││
│  │          1   4   5   6   7   8  11  12  13  14  15  18  19  (일)            ││
│  │                                                                             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. 키보드 단축키 (의사용)

| 단축키 | 동작 |
|--------|------|
| `/` 또는 `Ctrl+K` | 검색창 포커스 |
| `Enter` | 진찰 완료 + 저장 |
| `Tab` | 다음 입력 필드로 이동 |
| `Ctrl+T` | 처리 필요 체크 토글 |
| `Esc` | 검색창으로 복귀 |

---

## 9. 디자인 가이드

### 9.1 컬러 팔레트

```
Primary:     #2563EB (파란색 - 주요 액션)
Success:     #16A34A (초록 - 완료, 출석)
Warning:     #F59E0B (주황 - 주의, 대기)
Danger:      #DC2626 (빨강 - 결석, 오류)
Neutral:     #6B7280 (회색 - 보조 텍스트)
Background:  #F9FAFB (밝은 회색 - 배경)
```

### 9.2 아이콘 범례

```
💬 전달사항 있음
🔔 처리 필요
⏳ 대기 (진찰 전)
✓ 완료
✗ 결석/미완료
⚠️ 주의 필요
```

### 9.3 환자용 UI 원칙

- 글씨 크기: 최소 24px 이상
- 버튼/입력창 높이: 60px 이상
- 터치 영역: 50px 이상
- 단계: 2~3단계 이내 완료
- 확인 화면으로 오입력 방지

---

## 10. 구현 태스크

### Phase 0: 프로젝트 세팅 (3시간)

| # | 태스크 | 예상 시간 |
|---|--------|----------|
| 0-1 | Next.js 프로젝트 생성 + Tailwind 설정 | 30분 |
| 0-2 | Supabase 프로젝트 생성 + 연결 | 30분 |
| 0-3 | DB 스키마 생성 (SQL 실행) | 30분 |
| 0-4 | 기본 폴더 구조 세팅 | 30분 |
| 0-5 | 공통 컴포넌트 틀 (Layout, Button 등) | 1시간 |

### Phase 1: 인증 + 기본 구조 (6시간)

| # | 태스크 | 예상 시간 |
|---|--------|----------|
| 1-1 | staff 테이블 CRUD API | 1시간 |
| 1-2 | 로그인 API (bcrypt + JWT) | 2시간 |
| 1-3 | 로그인 페이지 UI | 1시간 |
| 1-4 | 인증 미들웨어 (role 체크) | 1시간 |
| 1-5 | 역할별 레이아웃/라우팅 분기 | 1시간 |

### Phase 2: 관리자 기능 (10시간)

| # | 태스크 | 예상 시간 |
|---|--------|----------|
| 2-1 | 직원 관리 (목록, 추가, 수정, 비활성화) | 3시간 |
| 2-2 | 환자 관리 (목록, 추가, 수정) | 3시간 |
| 2-3 | 환자-담당코디 매칭 | 1시간 |
| 2-4 | 기본 스케줄 관리 (요일별 패턴) | 2시간 |
| 2-5 | 일일 예정 출석 자동 생성 로직 | 1시간 |

### Phase 3: 환자용 화면 (7시간)

| # | 태스크 | 예상 시간 |
|---|--------|----------|
| 3-1 | 출석 체크 페이지 UI (이름 검색 + 체크) | 2시간 |
| 3-2 | 출석 API | 1시간 |
| 3-3 | 활력징후 입력 페이지 UI | 2시간 |
| 3-4 | 활력징후 API | 1시간 |
| 3-5 | 큰 글씨/버튼 스타일링, 접근성 | 1시간 |

### Phase 4: 의사용 화면 (14시간)

| # | 태스크 | 예상 시간 |
|---|--------|----------|
| 4-1 | 오늘 출석 환자 목록 API | 1시간 |
| 4-2 | 진찰 메인 화면 UI (목록 + 상세 분할) | 3시간 |
| 4-3 | 환자 검색 (초성 검색 포함) | 2시간 |
| 4-4 | 진찰 기록 저장 API | 1시간 |
| 4-5 | 전달사항 표시 (💬 아이콘 + 내용) | 1시간 |
| 4-6 | 처리 필요 항목 체크 + 지시 입력 | 1시간 |
| 4-7 | 처리 필요 목록 별도 화면 | 2시간 |
| 4-8 | 환자별 최근 기록 조회 (1개월) | 2시간 |
| 4-9 | 키보드 단축키 (/, Enter, Tab 등) | 1시간 |

### Phase 5: 직원용 화면 - 코디 (10시간)

| # | 태스크 | 예상 시간 |
|---|--------|----------|
| 5-1 | 담당 환자 목록 API | 1시간 |
| 5-2 | 대시보드 UI (출석/진찰/지시 상태) | 2시간 |
| 5-3 | 환자 상세 페이지 | 2시간 |
| 5-4 | 지시사항 처리 완료 체크 | 1시간 |
| 5-5 | 의사에게 전달사항 작성 | 2시간 |
| 5-6 | 모바일 반응형 최적화 | 2시간 |

### Phase 6: 간호사용 화면 (6시간)

| # | 태스크 | 예상 시간 |
|---|--------|----------|
| 6-1 | 오늘 처방 변경 목록 API | 1시간 |
| 6-2 | 처방 변경 목록 UI | 2시간 |
| 6-3 | 처리 완료 체크 | 1시간 |
| 6-4 | 의사에게 전달사항 작성 | 1시간 |
| 6-5 | 모바일 반응형 최적화 | 1시간 |

### Phase 7: 통계 + 마무리 (9시간)

| # | 태스크 | 예상 시간 |
|---|--------|----------|
| 7-1 | 일일 통계 집계 로직 | 2시간 |
| 7-2 | 출석률/진찰참석률 대시보드 | 2시간 |
| 7-3 | 예정 vs 실제 비교 화면 | 1시간 |
| 7-4 | 전체 테스트 + 버그 수정 | 3시간 |
| 7-5 | Vercel 배포 + 도메인 연결 | 1시간 |

### 예상 총 시간

| Phase | 시간 |
|-------|------|
| 0. 세팅 | 3시간 |
| 1. 인증 | 6시간 |
| 2. 관리자 | 10시간 |
| 3. 환자 | 7시간 |
| 4. 의사 | 14시간 |
| 5. 코디 | 10시간 |
| 6. 간호사 | 6시간 |
| 7. 통계/마무리 | 9시간 |
| **합계** | **약 65시간** |

### 권장 구현 순서

```
Phase 0 → 1 → 2 (일부: 직원/환자 기본 등록) → 3 → 4 → 2 (나머지) → 5 → 6 → 7
```

---

## 11. 향후 확장 고려사항 (Phase 2)

- LLM 연동: 환자별 AI 요약 (개인력 + 최근 상태 변화 + 제안)
- 푸시 알림: 처방 변경 시 담당자에게 알림
- 기존 스프레드시트 데이터 마이그레이션
- PWA 오프라인 지원

---

## 12. 초기 데이터

```sql
-- 관리자 계정 생성 (비밀번호: admin123)
-- bcrypt 해시는 실제 구현 시 생성
INSERT INTO staff (login_id, password_hash, name, role)
VALUES ('admin', '$2b$10$[해시값]', '관리자', 'admin');
```

---

*문서 버전: 1.0*
*최종 수정: 2024.11.28*

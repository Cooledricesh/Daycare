# Google Sheets 환자 데이터 동기화 시스템 설계

## 개요

Google Sheets (또는 Excel)에 있는 환자 명단을 DB와 매일 자동 동기화하여 환자 상태를 최신으로 유지하는 시스템

## 데이터 소스

### Excel/Google Sheets 컬럼 구조

| 컬럼 | 헤더명 | 설명 | DB 매핑 |
|------|--------|------|---------|
| A | No | 순번 | - |
| B | 호실 | 호실 번호 (필터 기준) | `room_number`, `coordinator_id` |
| C | IDNO | 병록번호 | `patient_id_no` (고유키) |
| D | 환자명 | 환자 이름 | `name` |
| E | 성/나 | 성별/나이 (예: M/45) | `gender` |
| F | 급종 | 보험 종류 | - |
| G | 입원일 | 입원 날짜 | - |
| H | 일 | 재원일수 | - |
| I | 과 | 진료과 | - |
| J | 의사명 | 담당 의사 | `doctor_id` |
| K | 수술일 | 수술 날짜 | - |
| L | 병명 | 진단명 | - |
| M | 수술명 | 수술명 | - |

### 필터링 조건

- **대상**: B열(호실) >= 3000 인 환자만 (낮병원 환자)
- 호실 < 3000: 병동 환자 (동기화 제외)

## 매핑 테이블

### 호실 → 담당 코디네이터 매핑

| 호실 | 담당자 이름 | staff.login_id (예상) |
|------|------------|---------------------|
| 3101 | 배수현 | coord_bae |
| 3102 | 김세은 | coord_kim_se |
| 3103 | 안중현 | coord_ahn |
| 3104 | 김용덕 | coord_kim_yd |
| 3105 | 조희숙 | coord_cho |
| 3106 | 권은경 | coord_kwon |
| 3111 | 박지예 | coord_park_jy |
| 3114 | 이관수 | coord_lee |
| 3118 | 김세훈 | coord_kim_sh |

### 의사명 → staff.id 매핑

| 의사명 | staff.login_id (예상) |
|--------|---------------------|
| 박승현 | doctor_park_sh |
| 이신화 | doctor_lee_sh |
| 박상운 | doctor_park_sw |
| 권도훈 | doctor_kwon |
| 이상철 | doctor_lee_sc |
| 박명현 | doctor_park_mh |
| 신정욱 | doctor_shin |
| ... | ... |

## 동기화 로직

### 1. 데이터 플로우

```
Google Sheets/Excel
       ↓
  [데이터 읽기]
       ↓
  [호실 >= 3000 필터링]
       ↓
  [병록번호(IDNO)로 DB 조회]
       ↓
  ┌─────────────────────────────────┐
  │        비교 및 처리              │
  ├─────────────────────────────────┤
  │ 신규 환자 → INSERT (active)     │
  │ 기존 환자 → UPDATE (변경사항)   │
  │ 명단에서 제거 → UPDATE (discharged) │
  └─────────────────────────────────┘
       ↓
  [동기화 로그 기록]
```

### 2. 변경 감지 항목

| 항목 | 동작 |
|------|------|
| 신규 환자 (IDNO 없음) | INSERT with status='active' |
| 호실 변경 | UPDATE room_number, coordinator_id |
| 담당 의사 변경 | UPDATE doctor_id |
| 이름 변경 | UPDATE name |
| 명단에서 삭제됨 | UPDATE status='discharged' |
| 명단에 재등장 | UPDATE status='active' |

### 3. 고유 키

- **primary key**: `patient_id_no` (병록번호/IDNO)
- 이름은 중복될 수 있으므로 병록번호로 식별

## API 설계

### POST /api/sync/patients

수동 동기화 트리거

```typescript
// Request
POST /api/sync/patients
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "source": "google_sheets" | "excel_upload",
  "fileUrl"?: string,  // Google Sheets URL
  "dryRun"?: boolean   // true면 실제 저장 없이 변경 예정 내역만 반환
}

// Response
{
  "success": true,
  "data": {
    "syncId": "uuid",
    "timestamp": "2025-01-22T10:00:00Z",
    "summary": {
      "totalProcessed": 266,
      "inserted": 5,
      "updated": 10,
      "discharged": 2,
      "unchanged": 249
    },
    "changes": [
      {
        "patientIdNo": "2125163",
        "name": "홍길동",
        "action": "insert" | "update" | "discharge",
        "changes": {
          "room_number": { "old": "3101", "new": "3102" },
          "coordinator": { "old": "배수현", "new": "김세은" }
        }
      }
    ]
  }
}
```

### GET /api/sync/logs

동기화 이력 조회

```typescript
// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "timestamp": "2025-01-22T10:00:00Z",
      "source": "google_sheets",
      "triggeredBy": "admin" | "scheduler",
      "summary": { ... },
      "status": "completed" | "failed",
      "errorMessage"?: string
    }
  ]
}
```

## DB 스키마 변경

### 새 테이블: sync_logs

```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(50) NOT NULL,  -- 'google_sheets', 'excel_upload'
  triggered_by VARCHAR(50) NOT NULL,  -- 'admin', 'scheduler'
  total_processed INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  discharged INTEGER DEFAULT 0,
  unchanged INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'running',  -- 'running', 'completed', 'failed'
  error_message TEXT,
  details JSONB
);
```

### 새 테이블: room_coordinator_mapping

```sql
CREATE TABLE room_coordinator_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number VARCHAR(10) UNIQUE NOT NULL,
  coordinator_id UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터
INSERT INTO room_coordinator_mapping (room_number, coordinator_id)
VALUES
  ('3101', (SELECT id FROM staff WHERE name = '배수현')),
  ('3102', (SELECT id FROM staff WHERE name = '김세은')),
  ('3103', (SELECT id FROM staff WHERE name = '안중현')),
  ('3104', (SELECT id FROM staff WHERE name = '김용덕')),
  ('3105', (SELECT id FROM staff WHERE name = '조희숙')),
  ('3106', (SELECT id FROM staff WHERE name = '권은경')),
  ('3111', (SELECT id FROM staff WHERE name = '박지예')),
  ('3114', (SELECT id FROM staff WHERE name = '이관수')),
  ('3118', (SELECT id FROM staff WHERE name = '김세훈'));
```

## 구현 계획

### Phase 1: 기본 인프라 (1단계)

1. DB 스키마 변경 (sync_logs, room_coordinator_mapping)
2. 매핑 테이블 데이터 입력
3. 동기화 서비스 구현 (`src/server/services/patient-sync.ts`)

### Phase 2: API & 스케줄러 (2단계)

1. `/api/sync/patients` 엔드포인트
2. `/api/sync/logs` 엔드포인트
3. 스케줄러 설정 (매일 오전 6시)

### Phase 3: 관리자 UI (3단계)

1. `/admin/sync` 페이지
   - 수동 동기화 버튼
   - 동기화 이력 조회
   - 변경 내역 상세 보기
   - Dry-run 모드 (미리보기)

### Phase 4: Google Sheets 연동 (4단계)

1. Google Cloud Console 설정
2. 서비스 계정 생성
3. Google Sheets API 연동
4. 자동 동기화 활성화

## 환경 변수

```env
# Google Sheets API (Phase 4)
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_SHEETS_ID=1cCREx565p_b1dQteZfA8vEIT3d85dfNP

# 동기화 설정
SYNC_CRON_SCHEDULE="0 6 * * *"  # 매일 오전 6시
SYNC_ENABLED=true
```

## 보안 고려사항

1. 동기화 API는 admin 권한 필요
2. Google 서비스 계정 키는 환경 변수로 관리
3. 동기화 로그에 민감 정보 제외
4. Dry-run 모드로 실수 방지

## 현재 환자 현황 (첨부 파일 기준)

- **총 낮병원 환자**: 266명
- **호실별 분포**:
  - 3101 (배수현): 35명
  - 3102 (김세은): 34명
  - 3103 (안중현): 30명
  - 3104 (김용덕): 35명
  - 3105 (조희숙): 31명
  - 3106 (권은경): 36명
  - 3111 (박지예): 20명
  - 3114 (이관수): 32명
  - 3118 (김세훈): 13명

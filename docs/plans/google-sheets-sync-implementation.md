# Google Sheets 환자 동기화 시스템 구현 계획

## 개요

Google Sheets/Excel의 환자 명단을 DB와 자동 동기화하여 환자 상태를 최신으로 유지하는 시스템

**핵심 요구사항:**
- B열(호실) >= 3000인 환자만 대상 (낮병원)
- 호실 번호로 담당 코디네이터 자동 매핑
- 매핑 관계는 관리자 UI에서 설정 가능
- 매일 자동 동기화 + 수동 동기화 지원

---

## Phase 1: DB 스키마 및 기본 인프라

### 1.1 새 테이블 생성

#### room_coordinator_mapping (호실-담당자 매핑)

```sql
CREATE TABLE room_coordinator_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_prefix VARCHAR(10) UNIQUE NOT NULL,  -- '3101', '3102', ...
  coordinator_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  description VARCHAR(100),  -- 관리자 메모용
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터 (coordinator_id는 나중에 UI에서 매핑)
INSERT INTO room_coordinator_mapping (room_prefix, description) VALUES
  ('3101', '배수현 담당'),
  ('3102', '김세은 담당'),
  ('3103', '안중현 담당'),
  ('3104', '김용덕 담당'),
  ('3105', '조희숙 담당'),
  ('3106', '권은경 담당'),
  ('3111', '박지예 담당'),
  ('3114', '이관수 담당'),
  ('3118', '김세훈 담당');
```

#### sync_logs (동기화 이력)

```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  source VARCHAR(50) NOT NULL,  -- 'google_sheets', 'excel_upload'
  triggered_by VARCHAR(50) NOT NULL,  -- 'admin', 'scheduler', 직원 ID
  status VARCHAR(20) DEFAULT 'running',  -- 'running', 'completed', 'failed'

  -- 통계
  total_in_source INTEGER DEFAULT 0,  -- 소스 파일의 총 환자 수
  total_processed INTEGER DEFAULT 0,  -- 처리된 환자 수
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  discharged INTEGER DEFAULT 0,
  reactivated INTEGER DEFAULT 0,
  unchanged INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,  -- 매핑 없음 등으로 스킵

  error_message TEXT,
  details JSONB,  -- 상세 변경 내역

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### doctor_name_mapping (의사명 매핑 - 선택사항)

```sql
CREATE TABLE doctor_name_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  excel_name VARCHAR(50) UNIQUE NOT NULL,  -- Excel의 의사명 (예: '박승현')
  doctor_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 기존 테이블 확인/수정

patients 테이블에 이미 있는 컬럼:
- `patient_id_no` (병록번호) - 동기화 키로 사용
- `room_number` (호실)
- `coordinator_id` (담당자)
- `doctor_id` (주치의)
- `status` (active/discharged/suspended)

**추가 필요 시:**
```sql
-- sync 관련 메타데이터 (선택사항)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS
  last_synced_at TIMESTAMPTZ,
  sync_source VARCHAR(50);  -- 마지막 동기화 소스
```

### 1.3 TypeScript 타입 정의

```typescript
// src/lib/supabase/types.ts에 추가

export interface RoomCoordinatorMapping {
  id: string;
  room_prefix: string;
  coordinator_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Join
  coordinator?: { id: string; name: string };
}

export interface SyncLog {
  id: string;
  started_at: string;
  completed_at: string | null;
  source: 'google_sheets' | 'excel_upload';
  triggered_by: string;
  status: 'running' | 'completed' | 'failed';
  total_in_source: number;
  total_processed: number;
  inserted: number;
  updated: number;
  discharged: number;
  reactivated: number;
  unchanged: number;
  skipped: number;
  error_message: string | null;
  details: SyncDetails | null;
}

export interface SyncDetails {
  changes: SyncChange[];
  skipped_reasons: { patientIdNo: string; reason: string }[];
}

export interface SyncChange {
  patientIdNo: string;
  name: string;
  action: 'insert' | 'update' | 'discharge' | 'reactivate';
  fields?: {
    [key: string]: { old: any; new: any };
  };
}
```

---

## Phase 2: 호실-담당자 매핑 관리 UI

### 2.1 관리자 페이지: `/admin/settings/room-mapping`

**기능:**
- 호실별 담당 코디네이터 할당/변경
- 새 호실 추가
- 비활성화 (is_active = false)

**UI 구성:**
```
┌─────────────────────────────────────────────────────┐
│  호실-담당자 매핑 설정                               │
├─────────────────────────────────────────────────────┤
│  [+ 호실 추가]                                      │
│                                                     │
│  호실    │ 담당 코디네이터      │ 메모      │ 상태  │
│  ────────┼──────────────────────┼───────────┼────── │
│  3101    │ [배수현 ▼]           │ 배수현 담당│ ✓    │
│  3102    │ [김세은 ▼]           │ 김세은 담당│ ✓    │
│  3103    │ [(미지정) ▼]         │ 안중현 담당│ ✓    │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

### 2.2 API 엔드포인트

```typescript
// GET /api/admin/settings/room-mapping
// 모든 호실 매핑 조회

// PUT /api/admin/settings/room-mapping/:room_prefix
// 특정 호실 매핑 수정
{
  coordinator_id: string | null,
  description?: string,
  is_active?: boolean
}

// POST /api/admin/settings/room-mapping
// 새 호실 매핑 추가
{
  room_prefix: string,
  coordinator_id?: string,
  description?: string
}

// DELETE /api/admin/settings/room-mapping/:room_prefix
// 매핑 삭제 (또는 비활성화)
```

### 2.3 파일 구조

```
src/
├── features/admin/
│   ├── backend/
│   │   ├── route.ts          # 기존 + room-mapping 라우트 추가
│   │   ├── service.ts        # 기존 + room-mapping 서비스 추가
│   │   └── schema.ts         # room-mapping 스키마 추가
│   ├── components/
│   │   └── RoomMappingTable.tsx  # 새 컴포넌트
│   └── hooks/
│       └── useRoomMapping.ts     # 새 훅
└── app/admin/settings/
    └── room-mapping/
        └── page.tsx              # 새 페이지
```

---

## Phase 3: 동기화 서비스 구현

### 3.1 핵심 서비스: `src/server/services/patient-sync.ts`

```typescript
interface SyncOptions {
  source: 'google_sheets' | 'excel_upload';
  triggeredBy: string;  // 'scheduler' 또는 staff_id
  dryRun?: boolean;     // true면 실제 저장 없이 변경 예정 내역만 반환
  fileBuffer?: Buffer;  // Excel 업로드 시
  sheetUrl?: string;    // Google Sheets URL
}

interface SyncResult {
  syncId: string;
  status: 'completed' | 'failed';
  summary: {
    totalInSource: number;
    totalProcessed: number;
    inserted: number;
    updated: number;
    discharged: number;
    reactivated: number;
    unchanged: number;
    skipped: number;
  };
  changes: SyncChange[];
  skippedReasons: { patientIdNo: string; reason: string }[];
  errorMessage?: string;
}

export class PatientSyncService {
  // 메인 동기화 함수
  async sync(options: SyncOptions): Promise<SyncResult>;

  // Excel 파일에서 환자 데이터 파싱
  private parseExcelData(buffer: Buffer): ParsedPatient[];

  // Google Sheets에서 데이터 가져오기
  private fetchGoogleSheetsData(sheetUrl: string): Promise<ParsedPatient[]>;

  // 호실 번호로 담당자 조회
  private getCoordinatorByRoom(roomNumber: string): Promise<string | null>;

  // 의사명으로 의사 ID 조회
  private getDoctorByName(doctorName: string): Promise<string | null>;

  // 기존 환자와 비교하여 변경사항 감지
  private detectChanges(
    sourcePatients: ParsedPatient[],
    dbPatients: Patient[]
  ): ChangeSet;

  // 변경사항 적용
  private applyChanges(changeSet: ChangeSet): Promise<void>;

  // 동기화 로그 기록
  private logSync(result: SyncResult): Promise<void>;
}

interface ParsedPatient {
  roomNumber: string;      // B열
  patientIdNo: string;     // C열 (IDNO)
  name: string;            // D열
  gender: 'M' | 'F' | null; // E열에서 추출
  doctorName: string;      // J열
}
```

### 3.2 동기화 로직 상세

```
1. 데이터 소스 읽기
   ├── Excel 파일 업로드 → xlsx 라이브러리로 파싱
   └── Google Sheets → Google Sheets API로 조회

2. 필터링
   └── 호실 >= 3000인 행만 추출

3. 데이터 변환
   ├── 호실 → coordinator_id (room_coordinator_mapping 테이블 조회)
   ├── 의사명 → doctor_id (staff 테이블 name으로 조회)
   └── 성별/나이 → gender 추출 ('M/45' → 'M')

4. DB 환자 데이터 조회
   └── patient_id_no로 기존 환자 목록 조회

5. 변경 감지
   ├── 소스에만 있음 → INSERT (신규)
   ├── DB에만 있음 → status='discharged' (퇴원 처리)
   └── 둘 다 있음 → 필드별 비교하여 UPDATE

6. 변경 적용 (dryRun=false일 때)
   ├── INSERT: 새 환자 추가
   ├── UPDATE: 변경된 필드만 업데이트
   └── DISCHARGE: status 변경

7. 로그 기록
   └── sync_logs 테이블에 결과 저장
```

### 3.3 API 엔드포인트

```typescript
// POST /api/admin/sync/patients
// 수동 동기화 실행
{
  source: 'excel_upload',
  dryRun?: boolean,
  // multipart/form-data로 Excel 파일 첨부
}

// GET /api/admin/sync/logs
// 동기화 이력 조회
// ?page=1&limit=20

// GET /api/admin/sync/logs/:id
// 특정 동기화 상세 조회
```

---

## Phase 4: 관리자 동기화 UI

### 4.1 동기화 대시보드: `/admin/sync`

**UI 구성:**

```
┌─────────────────────────────────────────────────────────────┐
│  환자 데이터 동기화                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Excel 파일 업로드                                   │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  📁 파일을 드래그하거나 클릭하여 업로드      │    │   │
│  │  │     (.xlsx, .xls)                           │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                     │   │
│  │  [미리보기] [동기화 실행]                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  최근 동기화 이력                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 시간              │ 소스     │ 상태   │ 결과        │   │
│  │ 2025-01-22 10:00 │ Excel   │ ✓ 완료 │ +5 ~10 -2  │   │
│  │ 2025-01-21 06:00 │ 스케줄러│ ✓ 완료 │ +0 ~3 -0   │   │
│  │ 2025-01-20 06:00 │ 스케줄러│ ✗ 실패 │ API 오류   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 미리보기 모달 (Dry Run)

```
┌─────────────────────────────────────────────────────────────┐
│  동기화 미리보기                                   [X]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  요약                                                       │
│  ├── 소스 파일 환자 수: 266명                              │
│  ├── 신규 추가 예정: 5명                                   │
│  ├── 정보 변경 예정: 10명                                  │
│  ├── 퇴원 처리 예정: 2명                                   │
│  └── 변경 없음: 249명                                      │
│                                                             │
│  ⚠️ 스킵 예정: 3명 (담당자 매핑 없음)                      │
│                                                             │
│  변경 상세                                    [필터: 전체 ▼] │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ➕ 홍길동 (IDNO: 2261234)                           │   │
│  │    호실: 3101 | 담당: 배수현 | 의사: 박승현          │   │
│  │                                                     │   │
│  │ 📝 김철수 (IDNO: 2125163)                           │   │
│  │    호실: 3101 → 3102                                │   │
│  │    담당: 배수현 → 김세은                            │   │
│  │                                                     │   │
│  │ ❌ 이영희 (IDNO: 2103845)                           │   │
│  │    상태: active → discharged                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                    [취소]  [동기화 실행]                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 파일 구조

```
src/
├── features/admin/
│   ├── components/
│   │   ├── SyncUploader.tsx       # 파일 업로드 컴포넌트
│   │   ├── SyncPreviewModal.tsx   # 미리보기 모달
│   │   ├── SyncLogTable.tsx       # 이력 테이블
│   │   └── SyncLogDetail.tsx      # 상세 보기
│   └── hooks/
│       ├── usePatientSync.ts      # 동기화 mutation
│       └── useSyncLogs.ts         # 이력 조회
└── app/admin/sync/
    └── page.tsx                   # 동기화 페이지
```

---

## Phase 5: 자동 스케줄러 (선택사항)

### 5.1 옵션 A: Vercel Cron (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-patients",
      "schedule": "0 6 * * *"
    }
  ]
}
```

```typescript
// src/app/api/cron/sync-patients/route.ts
export async function GET(request: Request) {
  // Vercel Cron 인증 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Google Sheets에서 동기화 실행
  const syncService = new PatientSyncService();
  const result = await syncService.sync({
    source: 'google_sheets',
    triggeredBy: 'scheduler',
    sheetUrl: process.env.GOOGLE_SHEETS_URL
  });

  return Response.json(result);
}
```

### 5.2 옵션 B: GitHub Actions

```yaml
# .github/workflows/sync-patients.yml
name: Patient Sync
on:
  schedule:
    - cron: '0 21 * * *'  # KST 06:00 = UTC 21:00
  workflow_dispatch:  # 수동 실행 가능

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/admin/sync/patients" \
            -H "Authorization: Bearer ${{ secrets.SYNC_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"source": "google_sheets"}'
```

---

## Phase 6: Google Sheets API 연동 (선택사항)

### 6.1 Google Cloud 설정

1. Google Cloud Console에서 프로젝트 생성
2. Google Sheets API 활성화
3. 서비스 계정 생성 → JSON 키 발급
4. 스프레드시트에 서비스 계정 이메일 공유 (뷰어 권한)

### 6.2 환경 변수

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=sync-bot@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_SHEETS_ID=1cCREx565p_b1dQteZfA8vEIT3d85dfNP
GOOGLE_SHEETS_RANGE=Sheet1!A:M
```

### 6.3 Google Sheets 읽기 서비스

```typescript
// src/server/services/google-sheets.ts
import { google } from 'googleapis';

export async function fetchGoogleSheetsData(sheetId: string): Promise<any[][]> {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: process.env.GOOGLE_SHEETS_RANGE || 'Sheet1!A:M',
  });

  return response.data.values || [];
}
```

---

## 구현 우선순위 및 일정

| 순서 | Phase | 내용 | 예상 작업 |
|------|-------|------|-----------|
| 1 | Phase 1 | DB 스키마 + 타입 정의 | SQL 마이그레이션, 타입 추가 |
| 2 | Phase 2 | 호실-담당자 매핑 UI | API + 페이지 구현 |
| 3 | Phase 3 | 동기화 서비스 | 핵심 로직 구현 |
| 4 | Phase 4 | 동기화 관리 UI | 업로드 + 이력 페이지 |
| 5 | Phase 5 | 자동 스케줄러 | Cron 설정 (선택) |
| 6 | Phase 6 | Google Sheets 연동 | API 연동 (선택) |

---

## 구현 시 고려사항

### 데이터 무결성
- 병록번호(IDNO)가 없거나 중복된 경우 스킵
- 호실 매핑이 없는 경우 스킵 후 로그 기록
- 트랜잭션으로 원자성 보장

### 에러 처리
- 파일 파싱 실패 시 명확한 에러 메시지
- 부분 실패 시에도 성공한 부분은 저장
- 모든 에러는 sync_logs에 기록

### 성능
- 대량 INSERT/UPDATE는 batch 처리
- 변경 없는 레코드는 UPDATE 스킵

### 보안
- 동기화 API는 admin 권한 필요
- 파일 업로드 크기 제한 (10MB)
- Google API 키는 환경 변수로 관리

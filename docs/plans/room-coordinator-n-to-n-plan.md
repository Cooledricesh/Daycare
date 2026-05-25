# 호실↔코디네이터 N:N 매핑 전환 Plan

> 1:1 강제 모델(`room_coordinator_mapping.room_prefix UNIQUE`)에서
> N:N 모델(`room_coordinator_assignments` join table + `patients.coordinator_id` primary cache)로 전환.

## 0. 결정 사항 (확정)

| 항목 | 결정 | 비고 |
| --- | --- | --- |
| Q1. 카디널리티 모델 | **옵션 1 (Join table + primary cache)** | `patients.coordinator_id`는 primary 캐시로 유지 |
| Q2. 권한 스코프 | **N:N 전체** — primary/backup/co 모두 읽기+쓰기 가능 | 자기 배정 호실 환자에 한해 |
| Q3. 통계 집계 | **primary only** — 워크로드 KPI는 primary만 합산 | 백업은 별도 컬럼("백업 호실/환자")로 표시만 |
| Q4. 만료일 | **없음** — `valid_from`/`valid_to` 컬럼 제외, `is_active`만 사용 | UI에도 만료일 입력 없음 |
| Q5. 알림 fan-out | **primary만** | 백업 알림은 후속 release에서 검토 |

## 1. 현황 진단

### 1-1. 현재 스키마 (1:1 강제)

```sql
-- supabase/migrations/20250122000001_patient_sync.sql
CREATE TABLE room_coordinator_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_prefix VARCHAR(10) UNIQUE NOT NULL,        -- ← 1:1 강제
  coordinator_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  description VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 별도 denormalized cache
patients.coordinator_id UUID REFERENCES staff(id)
```

### 1-2. 영향받는 소비자 (코드 스캔 결과)

`patients.coordinator_id` 참조처 — **유지** (캐시 패턴이므로 변경 불필요):

- `src/features/admin/backend/service.ts` — 환자 CRUD, 호실매핑 CRUD (하이브리드 캐스케이드)
- `src/features/doctor/backend/service.ts` — 의사 상담뷰 필터, 태스크 `completed_by`
- `src/features/nurse/backend/service.ts` — joined select
- `src/features/staff/backend/service.ts` — 코디 자신의 담당 환자 뷰
- `src/features/monthly-report/backend/calculators/coordinator.ts` — 워크로드 KPI
- `src/features/admin/components/CoordinatorWorkloadTable.tsx` — UI 1:1 가정
- `src/server/services/patient-sync.ts` — Excel sync (mapping 읽기 → patients 캐시 쓰기)

`room_coordinator_mapping` 직접 참조처 — **재작성 필요**:

- `src/features/admin/backend/service.ts::createRoomMapping` / `updateRoomMapping`
- `src/server/services/patient-sync.ts::getRoomMappings()`
- 관리자 호실매핑 페이지 컴포넌트 (`RoomMappingFormModal.tsx` 등)

→ Read path는 ~15곳이지만 캐시 패턴 덕에 손대지 않음. 실제 touch points는 write path 위주.

## 2. 목표 스키마

```sql
-- 새 join table
CREATE TABLE room_coordinator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_prefix VARCHAR(10) NOT NULL,
  coordinator_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('primary', 'backup', 'co')),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_prefix, coordinator_id)
);

-- 호실당 primary는 1명만 (부분 unique)
CREATE UNIQUE INDEX uniq_room_primary
  ON room_coordinator_assignments (room_prefix)
  WHERE role = 'primary' AND is_active = true;

CREATE INDEX idx_assignments_room ON room_coordinator_assignments(room_prefix);
CREATE INDEX idx_assignments_coordinator ON room_coordinator_assignments(coordinator_id);
CREATE INDEX idx_assignments_role ON room_coordinator_assignments(role) WHERE is_active = true;

CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON room_coordinator_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

`patients.coordinator_id`는 그대로 유지 — 의미만 재정의: **"환자가 속한 호실의 현재 primary 코디"** (캐시).

만료일/temporal 컬럼은 명시적으로 제외 (`valid_from`/`valid_to` 없음).

## 3. 단계별 작업 (Phase 1~6)

각 Phase는 독립적으로 revertable. **절대 한 PR에 합치지 않음**.

---

### Phase 1 — DB Migration (2개 파일)

**Migration A**: `supabase/migrations/20260XXX01_create_room_coordinator_assignments.sql`

```sql
-- room_coordinator_assignments 테이블 + 인덱스 + 트리거 생성
-- (위 스키마 그대로)
```

**Migration B**: `supabase/migrations/20260XXX02_backfill_room_coordinator_assignments.sql`

```sql
INSERT INTO room_coordinator_assignments
  (room_prefix, coordinator_id, role, is_active, description)
SELECT
  room_prefix,
  coordinator_id,
  'primary',
  is_active,
  description
FROM room_coordinator_mapping
WHERE coordinator_id IS NOT NULL
ON CONFLICT (room_prefix, coordinator_id) DO NOTHING;
```

**중요**: `room_coordinator_mapping` 테이블은 **drop하지 않음** (Phase 6에서 처리).
주석으로 `-- DEPRECATED: see room_coordinator_assignments` 만 추가.

**검증**: 마이그레이션 적용 후 SQL로 확인
```sql
SELECT COUNT(*) FROM room_coordinator_mapping WHERE coordinator_id IS NOT NULL;
SELECT COUNT(*) FROM room_coordinator_assignments WHERE role = 'primary';
-- 두 수치 일치해야 함
```

---

### Phase 2 — Backend Write Path 재작성

**파일**: `src/features/admin/backend/service.ts`, `src/features/admin/backend/schema.ts`, `src/features/admin/backend/route.ts`

#### 2-1. Schema 확장

```typescript
// schema.ts
const RoomCoordinatorAssignmentSchema = z.object({
  coordinator_id: z.string().uuid(),
  role: z.enum(['primary', 'backup', 'co']),
  display_order: z.number().int().default(0),
});

const CreateRoomMappingSchema = z.object({
  room_prefix: z.string().min(1).max(10),
  description: z.string().max(100).optional(),
  assignments: z.array(RoomCoordinatorAssignmentSchema)
    .min(1, '최소 1명의 primary 코디가 필요합니다.')
    .refine(
      (arr) => arr.filter((a) => a.role === 'primary').length === 1,
      'primary 코디는 정확히 1명이어야 합니다.'
    ),
});
```

#### 2-2. service.ts 핵심 함수

```typescript
// createRoomMapping / updateRoomMapping 재작성

async function createRoomMapping(supabase, input) {
  // 1. room_coordinator_mapping 에는 (호환 위해) primary만 기록 — 또는 Phase 6에서 정리
  //    여기서는 새 테이블만 쓰는 방향 권장.
  // 2. room_coordinator_assignments 에 모든 assignment insert
  // 3. patients.coordinator_id 캐시 동기화 — primary로
  //    (해당 room_prefix의 활성 환자 전체)
}

async function updateRoomMapping(supabase, id, input) {
  // 1. 기존 assignments 삭제 또는 diff 후 upsert
  // 2. 새 assignments insert
  // 3. primary가 변경됐다면 → patients.coordinator_id 캐시 update
}

// 신규 헬퍼 (재사용)
async function syncPatientCoordinatorCache(supabase, roomPrefix: string) {
  const { data: primary } = await supabase
    .from('room_coordinator_assignments')
    .select('coordinator_id')
    .eq('room_prefix', roomPrefix)
    .eq('role', 'primary')
    .eq('is_active', true)
    .maybeSingle();

  // 해당 호실의 활성 환자 coordinator_id 업데이트
  await supabase
    .from('patients')
    .update({ coordinator_id: primary?.coordinator_id ?? null })
    .like('room', `${roomPrefix}%`)
    .eq('is_active', true);
}
```

#### 2-3. Excel/Sheets sync 수정

**파일**: `src/server/services/patient-sync.ts`

```typescript
async function getRoomMappings(supabase) {
  // BEFORE: from('room_coordinator_mapping')
  // AFTER: primary만 select
  return supabase
    .from('room_coordinator_assignments')
    .select('room_prefix, coordinator_id')
    .eq('role', 'primary')
    .eq('is_active', true);
}
```

→ **sync는 primary만 갱신**. backup/co row는 절대 건드리지 않음 (수동 관리).

---

### Phase 3 — Backend Read Path (선택적 수정)

대부분 변경 없음. **2가지만 widen**:

#### 3-1. RBAC 권한 헬퍼 신규

**파일**: `src/features/auth/backend/permissions.ts` (신규 또는 기존 위치)

```typescript
/**
 * 해당 코디가 환자에 대해 권한을 가지는지 확인.
 * primary/backup/co 어떤 role이든 활성 assignment가 있으면 허용.
 */
export async function canCoordinatorAccessPatient(
  supabase: SupabaseClient,
  staffId: string,
  patientId: string,
): Promise<boolean> {
  const { data: patient } = await supabase
    .from('patients')
    .select('room')
    .eq('id', patientId)
    .maybeSingle();

  if (!patient?.room) return false;

  const roomPrefix = extractRoomPrefix(patient.room); // 기존 유틸 재사용

  const { data: assignment } = await supabase
    .from('room_coordinator_assignments')
    .select('id')
    .eq('room_prefix', roomPrefix)
    .eq('coordinator_id', staffId)
    .eq('is_active', true)
    .maybeSingle();

  return !!assignment;
}
```

#### 3-2. 코디 본인 화면의 "내 호실/환자 목록"

`src/features/staff/backend/service.ts` 의 본인 담당 환자 조회를 widen:

```typescript
// BEFORE: .eq('coordinator_id', staffId)
// AFTER: assignments 기준으로 room_prefix 목록 가져온 후 patient.room LIKE 매칭
async function getMyPatients(supabase, staffId) {
  const { data: rooms } = await supabase
    .from('room_coordinator_assignments')
    .select('room_prefix, role')
    .eq('coordinator_id', staffId)
    .eq('is_active', true);

  if (!rooms?.length) return [];

  const prefixes = rooms.map((r) => r.room_prefix);
  // patient.room LIKE any(prefix||'%') — OR 조건으로 묶어 query
  return supabase.from('patients')
    .select('*')
    .or(prefixes.map((p) => `room.like.${p}%`).join(','))
    .eq('is_active', true);
}
```

다른 read path (doctor, nurse, monthly-report)는 **변경 없음** — primary cache (`patients.coordinator_id`) 그대로 사용.

---

### Phase 4 — UI

**파일**: `src/features/admin/components/RoomMappingFormModal.tsx`

- 단일 `Select` → `useFieldArray` 다중 행
- 첫 행은 `role='primary'` 고정 (disabled), 필수
- 추가 행은 role 드롭다운 (`backup` / `co`) 선택 가능
- **만료일 입력 없음**
- 행 추가/삭제 버튼

**파일**: `src/features/admin/components/RoomMappingList.tsx` (또는 동등 위치)

- 호실별 코디 목록을 chip/badge로 표시
- primary는 강조 색상, backup/co는 보조 색상

---

### Phase 5 — Stats / Workload UI

**파일**: `src/features/admin/components/CoordinatorWorkloadTable.tsx`

새 컬럼 2개 추가 (primary 워크로드는 그대로 유지):

| 코디 | Primary 호실 | Primary 환자 수 | **백업 호실** | **백업 환자 수** | 기타 KPI |
| --- | --- | --- | --- | --- | --- |

- "백업 호실 수": `assignments where coordinator_id = X AND role IN ('backup', 'co') AND is_active`
- "백업 환자 수": 위 호실들의 활성 환자 합계
- **절대 primary와 합산하지 않음** — 별도 컬럼

**파일**: `src/features/monthly-report/backend/calculators/coordinator.ts`

- 변경 없음. 기존 `patients.coordinator_id` 기준 KPI 그대로.
- 필요 시 백업 KPI는 별도 calculator로 추가 (이번 plan 범위 외).

---

### Phase 6 — Cleanup (다음 release)

**선결 조건**: Phase 1~5 production 배포 후 **최소 1주 안정 운영 확인**.

1. `room_coordinator_mapping` 테이블 drop migration 작성.
2. 관련 시드/마이그레이션 주석 정리.
3. 본 plan 문서에 "v2 완료" 마크.

→ 이번 plan에는 포함하지 않음. 별도 follow-up issue.

## 4. 테스트 계획

### 4-1. 마이그레이션 검증 (Phase 1)

```sql
-- 기존 1:1 매핑 수 = 새 테이블 primary 수
SELECT
  (SELECT COUNT(*) FROM room_coordinator_mapping WHERE coordinator_id IS NOT NULL) AS old_count,
  (SELECT COUNT(*) FROM room_coordinator_assignments WHERE role = 'primary' AND is_active = true) AS new_primary_count;
```

### 4-2. 단위 테스트 (Phase 2)

`src/features/admin/backend/service.test.ts` 에 추가:

- `createRoomMapping`: primary 1명 + backup 2명 입력 → 3개 row, 캐시 동기화 확인
- `createRoomMapping`: primary 0명 → 스키마 검증 실패
- `createRoomMapping`: primary 2명 → 스키마 검증 실패
- `updateRoomMapping`: primary 교체 → `patients.coordinator_id` 캐시 변경 확인
- `updateRoomMapping`: backup만 변경 → `patients.coordinator_id` 캐시 불변 확인

### 4-3. 통합 테스트 (Phase 3)

- 백업 코디로 로그인 → 자기 호실 환자 메시지 작성 가능
- 백업 코디로 로그인 → 다른 호실 환자 접근 차단
- Excel sync 실행 → primary만 갱신, backup row 보존

### 4-4. 회귀 테스트

- 기존 `patients.coordinator_id` 의존 read path 전부 정상 동작
- CoordinatorWorkloadTable 기존 KPI 수치 변동 없음 (primary 동일)
- 의사 상담뷰 필터 정상

## 5. 마이그레이션 적용 순서

승현님께서 Supabase에 직접 적용하셔야 합니다 (AGENTS.md 규칙).

1. Migration A 적용 → 테이블 생성 확인
2. Migration B 적용 → backfill 결과 SQL로 검증 (위 4-1)
3. 이후 코드 배포 (Phase 2~5)

## 6. 리스크 / 주의사항

| 리스크 | 완화 |
| --- | --- |
| 캐시 drift (assignments 변경 시 `patients.coordinator_id` 동기화 누락) | `syncPatientCoordinatorCache` 헬퍼를 모든 write path에서 호출. 트리거 도입은 v2 검토. |
| Excel sync가 backup row를 덮어쓸 가능성 | sync는 `role='primary'`만 read/write 하도록 명시적 제약. 단위 테스트로 보장. |
| 호실당 primary 2개 이상 동시 insert (race condition) | `uniq_room_primary` 부분 unique index가 DB 레벨에서 차단. |
| RBAC widen 후 백업 코디가 의도치 않은 환자에 접근 | `canCoordinatorAccessPatient` 헬퍼 한 곳에서만 권한 결정. 미들웨어 일관성. |
| `room_coordinator_mapping` 옛 테이블 잔존으로 인한 혼동 | DEPRECATED 주석 + Phase 6 cleanup 약속. 신규 코드는 새 테이블만 참조. |

## 7. 작업 분할 (구현 진행 시)

| Stage | PR 단위 | 예상 변경 파일 수 |
| --- | --- | --- |
| Phase 1 | DB Migration A + B (2 SQL 파일) | 2 |
| Phase 2 | Backend write + Excel sync | ~5 |
| Phase 3 | RBAC helper + staff read widen | ~3 |
| Phase 4 | UI form 다중 행 | ~2 |
| Phase 5 | CoordinatorWorkloadTable 백업 컬럼 | ~2 |
| Phase 6 | (별도 PR, 1주 후) Cleanup drop | 1 |

각 Phase별 별도 PR 권장. 한꺼번에 머지 시 롤백 난이도 폭증.

## 8. 범위 외 (Out of scope)

- 알림 fan-out 확장 (백업 알림) — 후속
- Temporal/만료일 컬럼 — 명시적 제외 결정
- `room_coordinator_mapping` drop — Phase 6 (별도 release)
- 백업 KPI 별도 calculator — Phase 5에 UI만, monthly report 계산은 추후
- 트리거 기반 캐시 동기화 — service-layer 호출로 충분, v2 검토

---

## 다음 액션

1. 본 plan 리뷰
2. 승인 시 Phase 1 마이그레이션 SQL 2개 작성 → 승현님이 Supabase에 적용
3. 적용 결과 검증 후 Phase 2 진행

# Phase 2: 타입 안전성 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 192개의 `as any` 캐스팅을 제거하여 Supabase 쿼리의 완전한 타입 안전성을 확보한다.

**Architecture:** `Database` 인터페이스에 누락된 테이블(`holidays`, `prescriptions`, `notification_dismissals`)을 추가하고, 이미 정의된 테이블의 `as any` 캐스팅을 순차적으로 제거한다. 각 서비스 파일을 feature 단위로 처리하며, 기존 테스트가 통과하는지 매 단계 확인한다.

**Tech Stack:** TypeScript, Supabase, Vitest

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/supabase/types.ts` | 누락 테이블 3개 추가 |
| Modify | `src/server/services/task.ts` | `as any` 2개 제거 |
| Modify | `src/server/services/message.ts` | `as any` 3개 제거 |
| Modify | `src/server/services/patient-sync.ts` | `as any` ~10개 제거 |
| Modify | `src/server/services/schedule.ts` | `as any` 3개 제거 |
| Modify | `src/lib/business-days.ts` | `as any` 1개 제거 |
| Modify | `src/features/notification/backend/service.ts` | `as any` 4개 제거 |
| Modify | `src/features/absence-risk/backend/service.ts` | `as any` 7개 제거 |
| Modify | `src/features/vitals-monitoring/backend/service.ts` | `as any` 3개 제거 |
| Modify | `src/features/patient/backend/service.ts` | `as any` 2개 제거 |
| Modify | `src/features/nurse/backend/service.ts` | `as any` 7개 제거 |
| Modify | `src/features/staff/backend/service.ts` | `as any` ~31개 제거 |
| Modify | `src/features/doctor/backend/service.ts` | `as any` ~23개 제거 |
| Modify | `src/features/admin/backend/service.ts` | `as any` ~34개 제거 |
| Modify | `src/features/shared/backend/route.ts` | `as any` 5개 제거 |
| Modify | `src/features/admin/components/StaffFormModal.tsx` | `as any` 2개 제거 |
| Modify | `src/features/admin/components/PatientFormModal.tsx` | `as any` 1개 제거 |

---

### Task 1: Database 타입에 누락 테이블 추가

**Files:**
- Modify: `src/lib/supabase/types.ts:469` (닫는 중괄호 직전)

- [ ] **Step 1: 누락 테이블 스키마 확인**

Run: `ls supabase/migrations/` — holidays, prescriptions, notification_dismissals 테이블의 마이그레이션 SQL을 확인한다.

- [ ] **Step 2: Database 인터페이스에 holidays 테이블 추가**

`src/lib/supabase/types.ts`의 `sync_logs` 테이블 정의 뒤(468번 줄 직전)에 추가:

```typescript
            holidays: {
                Row: {
                    id: string;
                    date: string;
                    name: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    date: string;
                    name: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    date?: string;
                    name?: string;
                    created_at?: string;
                };
            };
```

- [ ] **Step 3: notification_dismissals 테이블 추가**

```typescript
            notification_dismissals: {
                Row: {
                    id: string;
                    staff_id: string;
                    sync_log_id: string;
                    dismissed_at: string;
                };
                Insert: {
                    id?: string;
                    staff_id: string;
                    sync_log_id: string;
                    dismissed_at?: string;
                };
                Update: {
                    id?: string;
                    staff_id?: string;
                    sync_log_id?: string;
                    dismissed_at?: string;
                };
            };
```

- [ ] **Step 4: prescriptions 테이블 추가**

마이그레이션 SQL에서 정확한 스키마를 확인 후 추가한다. 컬럼이 불확실하면 nurse service의 prescriptions 쿼리에서 select 컬럼을 역추적한다.

- [ ] **Step 5: 타입 체크 실행**

Run: `npx tsc --noEmit 2>&1 | head -50`
Expected: 기존 코드에 영향 없음 (추가만 했으므로)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat(types): Database 인터페이스에 누락 테이블 추가"
```

---

### Task 2: 공통 서비스 as any 제거 (task, message, schedule, business-days)

**Files:**
- Modify: `src/server/services/task.ts:40-41,66-67`
- Modify: `src/server/services/message.ts:40,75,119-120`
- Modify: `src/server/services/schedule.ts:12,25,41`
- Modify: `src/lib/business-days.ts:20`

- [ ] **Step 1: task.ts의 as any 제거**

변경 전:
```typescript
const { data: taskCompletion, error: findError } = await (supabase
    .from('task_completions') as any)
```

변경 후:
```typescript
const { data: taskCompletion, error: findError } = await supabase
    .from('task_completions')
```

두 곳 모두 동일하게 처리 (line 40, line 66).

- [ ] **Step 2: message.ts의 as any 제거**

3곳 모두 `(supabase.from('messages') as any)` → `supabase.from('messages')`로 변경.

- [ ] **Step 3: schedule.ts의 as any 제거**

3곳 모두 `(supabase.from('scheduled_attendances') as any)` 및 `(supabase.from('scheduled_patterns') as any)` 패턴 제거.

- [ ] **Step 4: business-days.ts의 as any 제거**

```typescript
// Before
supabase.from('holidays') as any
// After
supabase.from('holidays')
```

- [ ] **Step 5: 타입 체크 + 테스트 실행**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/server/services/task.ts src/server/services/message.ts src/server/services/schedule.ts src/lib/business-days.ts
git commit -m "fix(types): 공통 서비스 as any 캐스팅 제거"
```

---

### Task 3: Feature 서비스 as any 제거 — 소규모 (notification, patient, vitals-monitoring)

**Files:**
- Modify: `src/features/notification/backend/service.ts` (4곳)
- Modify: `src/features/patient/backend/service.ts` (2곳)
- Modify: `src/features/vitals-monitoring/backend/service.ts` (3곳)

- [ ] **Step 1: notification service — notification_dismissals, sync_logs 캐스팅 제거**

4곳 모두 `(supabase.from('notification_dismissals') as any)` → `supabase.from('notification_dismissals')` 패턴.

- [ ] **Step 2: patient service — insert/upsert 캐스팅 제거**

Line 79: `.insert([insertData] as any)` → `.insert([insertData])` — insertData가 Insert 타입과 맞는지 확인.
Line 136: `.upsert([insertData] as any, ...)` → `.upsert([insertData], ...)` — 동일.

타입 불일치 시 insertData에 명시적 타입 어노테이션 추가.

- [ ] **Step 3: vitals-monitoring service 캐스팅 제거**

3곳 모두 `(supabase.from('patients') as any)`, `(supabase.from('vitals') as any)` 패턴 제거.

- [ ] **Step 4: 타입 체크 + 테스트 실행**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/notification/backend/service.ts src/features/patient/backend/service.ts src/features/vitals-monitoring/backend/service.ts
git commit -m "fix(types): 소규모 feature 서비스 as any 제거"
```

---

### Task 4: Feature 서비스 as any 제거 — absence-risk, nurse

**Files:**
- Modify: `src/features/absence-risk/backend/service.ts` (7곳)
- Modify: `src/features/nurse/backend/service.ts` (7곳)

- [ ] **Step 1: absence-risk service 캐스팅 제거**

7곳 모두 `(supabase.from('patients') as any)`, `(supabase.from('scheduled_attendances') as any)`, `(supabase.from('attendances') as any)` 등 패턴 제거.

- [ ] **Step 2: nurse service 캐스팅 제거**

6곳의 `.from() as any` 패턴 제거.

Line 181의 특수 케이스: `const items: PrescriptionItem[] = (data as any[])` — prescriptions 테이블 타입이 추가되었으면 적절한 타입으로 교체. 아직 추가되지 않았으면 TODO 주석 남기고 스킵.

- [ ] **Step 3: 타입 체크 + 테스트 실행**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/absence-risk/backend/service.ts src/features/nurse/backend/service.ts
git commit -m "fix(types): absence-risk, nurse 서비스 as any 제거"
```

---

### Task 5: Feature 서비스 as any 제거 — staff (최대 규모)

**Files:**
- Modify: `src/features/staff/backend/service.ts` (~31곳)

- [ ] **Step 1: RPC 호출 타입 처리**

Line 52의 `(supabase.rpc as any)` — Supabase RPC 타입은 Database 인터페이스의 Functions 섹션이 필요. Functions 섹션이 없으면 `supabase.rpc('function_name', params)` 형태로 유지하되, 반환 타입만 명시적으로 지정:

```typescript
const { data, error } = await supabase.rpc('get_coordinator_patients', { p_coordinator_id: staffId }) as unknown as { data: PatientRow[] | null; error: PostgrestError | null };
```

단, Functions 타입을 Database에 추가하는 것이 이상적. RPC 함수명과 파라미터를 마이그레이션에서 확인 후 추가.

- [ ] **Step 2: from() as any 패턴 일괄 제거**

나머지 ~30곳의 `(supabase.from('table_name') as any)` 패턴을 `supabase.from('table_name')`으로 변경.

- [ ] **Step 3: 데이터 캐스팅 처리**

Line 276-295 영역의 `consultation as any`, `patient as any` 등 — 쿼리 결과에서 nested relation 접근 시 발생. Supabase의 select 체인 결과 타입이 복잡한 경우, 명시적 인터페이스로 대체:

```typescript
interface PatientWithRelations {
  id: string;
  name: string;
  coordinator: { id: string; name: string } | null;
  // ... 필요한 필드
}
```

- [ ] **Step 4: 타입 체크 + 테스트 실행**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/staff/backend/service.ts
git commit -m "fix(types): staff 서비스 as any 제거"
```

---

### Task 6: Feature 서비스 as any 제거 — doctor

**Files:**
- Modify: `src/features/doctor/backend/service.ts` (~23곳)

- [ ] **Step 1: from() as any 패턴 일괄 제거**

모든 `(supabase.from('consultations') as any)`, `(supabase.from('patients') as any)` 등 패턴 제거.

- [ ] **Step 2: nested select 결과 타입 처리**

Task 5 Step 3과 동일 패턴. 필요시 로컬 인터페이스 정의.

- [ ] **Step 3: 타입 체크 + 테스트 실행**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/doctor/backend/service.ts
git commit -m "fix(types): doctor 서비스 as any 제거"
```

---

### Task 7: Feature 서비스 as any 제거 — admin (최대 규모)

**Files:**
- Modify: `src/features/admin/backend/service.ts` (~34곳)

- [ ] **Step 1: from() as any 패턴 일괄 제거**

~25곳의 `(supabase.from('table_name') as any)` 패턴 제거.

- [ ] **Step 2: 데이터 캐스팅 처리**

Line 99: `(data as any)?.map((p: any)` → 적절한 타입으로 교체.
Line 107: `(patterns as any)?.forEach((p: any)` → 동일.
Line 178: `const patientData = data as any` → 쿼리 결과 타입 활용.
Line 559: `(patterns as any)?.forEach` → 동일.

- [ ] **Step 3: 타입 체크 + 테스트 실행**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/admin/backend/service.ts
git commit -m "fix(types): admin 서비스 as any 제거"
```

---

### Task 8: shared route + UI 컴포넌트 as any 제거

**Files:**
- Modify: `src/features/shared/backend/route.ts` (5곳)
- Modify: `src/features/admin/components/StaffFormModal.tsx` (2곳)
- Modify: `src/features/admin/components/PatientFormModal.tsx` (1곳)

- [ ] **Step 1: shared route의 from() as any 제거**

5곳 모두 동일 패턴.

- [ ] **Step 2: StaffFormModal — react-hook-form 캐스팅 수정**

Line 143: `{...(form as any).register('name')}` — form의 제네릭 타입을 정확히 지정:
```typescript
const form = useForm<StaffFormValues>(); // 이미 타입이 있다면 캐스팅 불필요
```

Line 196: `(form as any).setValue(...)` → `form.setValue(...)` — 동일하게 제네릭 타입 확인.

- [ ] **Step 3: PatientFormModal — enum 캐스팅 수정**

Line 310: `setValue('status', value as any)` → `setValue('status', value as PatientStatus)` 또는 zod 스키마의 enum 타입 직접 사용.

- [ ] **Step 4: 타입 체크 + 빌드 테스트**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/shared/backend/route.ts src/features/admin/components/StaffFormModal.tsx src/features/admin/components/PatientFormModal.tsx
git commit -m "fix(types): shared route 및 UI 컴포넌트 as any 제거"
```

---

### Task 9: 최종 검증

- [ ] **Step 1: 남은 as any 확인**

Run: `grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test." | wc -l`
Expected: 0 또는 테스트 파일의 mock만 남음

- [ ] **Step 2: 전체 빌드 + 테스트**

Run: `npm run build && npm test -- --run`
Expected: PASS

- [ ] **Step 3: 커밋 (필요시)**

남은 항목이 있으면 추가 수정 후 커밋.

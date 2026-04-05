# Phase 6: 성능 최적화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** N+1 쿼리 패턴을 해결하고, React Query invalidation을 정밀화하여 불필요한 리페치를 줄인다.

**Architecture:** Supabase의 JOIN/nested select 기능을 활용하여 별도 쿼리를 통합한다. Promise.all로 병렬화된 쿼리 중 동일 테이블 중복 쿼리를 제거한다. React Query의 `exact` 옵션과 세분화된 queryKey로 불필요한 캐시 무효화를 방지한다.

**Tech Stack:** Supabase, @tanstack/react-query

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/features/admin/backend/service.ts` | N+1 쿼리 통합 |
| Modify | `src/features/staff/backend/service.ts` | 중복 consultation 쿼리 제거 |
| Modify | `src/features/doctor/backend/service.ts` | 쿼리 통합 |
| Modify | `src/server/services/patient-sync.ts` | 루프 내 UPDATE → 배치 처리 |
| Modify | `src/features/*/hooks/*.ts` | queryKey 세분화 + exact invalidation |

---

### Task 1: Admin getPatients — scheduled_patterns JOIN 통합

**Files:**
- Modify: `src/features/admin/backend/service.ts:51-137`

**분석:** 현재 patients 쿼리 후 별도로 scheduled_patterns를 쿼리하여 map을 빌드한다. Supabase nested select로 한 번에 가져올 수 있다.

- [ ] **Step 1: 현재 쿼리 패턴 확인**

`src/features/admin/backend/service.ts`의 `getPatients` 함수에서:
1. Line ~87: `supabase.from('patients').select(...)` — 환자 목록
2. Line ~100: `supabase.from('scheduled_patterns').select(...)` — 별도 쿼리
3. Line ~107: `patterns.forEach(...)` — map 빌드

- [ ] **Step 2: nested select로 통합**

변경 전:
```typescript
const { data } = await supabase.from('patients').select('id, name, ...');
const { data: patterns } = await supabase.from('scheduled_patterns').select('patient_id, day_of_week').eq('is_active', true);
// patterns를 map으로 변환
```

변경 후:
```typescript
const { data } = await supabase
  .from('patients')
  .select('id, name, ..., scheduled_patterns(day_of_week)')
  .eq('scheduled_patterns.is_active', true);
```

이렇게 하면 별도 쿼리 + map 빌드 코드가 불필요해진다. `data[i].scheduled_patterns`로 직접 접근.

- [ ] **Step 3: 반환 데이터 매핑 수정**

기존의 `patternMap.get(patient.id)` 접근을 `patient.scheduled_patterns.map(p => p.day_of_week)` 로 변경.

- [ ] **Step 4: 타입 체크 + 테스트**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/admin/backend/service.ts
git commit -m "perf(admin): getPatients scheduled_patterns 쿼리 통합"
```

---

### Task 2: Admin getDailyStats — 중복 daily_stats 쿼리 제거

**Files:**
- Modify: `src/features/admin/backend/service.ts` (getDailyStats 함수)

**분석:** Promise.all 내에서 `daily_stats` 테이블을 2번 쿼리하고 있다.

- [ ] **Step 1: 중복 쿼리 확인**

`getDailyStats` 함수의 Promise.all 배열에서 daily_stats 쿼리가 2개인지 확인.

- [ ] **Step 2: 중복 제거**

하나의 daily_stats 쿼리만 남기고, 결과를 재사용.

- [ ] **Step 3: 타입 체크 + 테스트**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/admin/backend/service.ts
git commit -m "perf(admin): getDailyStats 중복 daily_stats 쿼리 제거"
```

---

### Task 3: Staff getPatientDetail — 중복 consultation 쿼리 제거

**Files:**
- Modify: `src/features/staff/backend/service.ts:210-305`

**분석:** `getPatientDetail`의 Promise.all에서 consultations를 2번 쿼리:
1. 오늘 날짜 consultation (task_completions 포함)
2. 최근 consultations (recentConsultations)

두 쿼리는 다른 목적이지만, 날짜 필터가 겹칠 수 있다.

- [ ] **Step 1: 두 consultation 쿼리의 정확한 차이 확인**

Run: `sed -n '229,265p' src/features/staff/backend/service.ts`
첫 번째: `.eq('date', date)` — 오늘
두 번째: `.order('date', { ascending: false }).limit(5)` — 최근 5개

- [ ] **Step 2: 최적화 방안 결정**

두 쿼리의 목적이 다르므로(오늘 상세 vs 최근 목록), 통합은 부적절. 대신 오늘 날짜가 최근 5개에 포함될 경우 중복 데이터가 전송된다.

**방안 A**: 두 번째 쿼리에 `.neq('date', date)` 추가하여 중복 제거.
**방안 B**: 현상 유지 (영향 미미).

방안 A를 적용.

- [ ] **Step 3: 커밋**

```bash
git add src/features/staff/backend/service.ts
git commit -m "perf(staff): getPatientDetail 중복 consultation 데이터 제거"
```

---

### Task 4: Patient-sync — 루프 내 UPDATE 배치 처리

**Files:**
- Modify: `src/server/services/patient-sync.ts:414-456`

**분석:** 퇴원 처리 시 환자별 개별 UPDATE를 루프 안에서 실행. 환자 수가 많으면 성능 저하.

- [ ] **Step 1: 현재 루프 패턴 확인**

```typescript
for (const [patientIdNo, patient] of existingPatients) {
  if (!options.dryRun) {
    await supabase.from('patients')
      .update({ status: 'discharged', ... })
      .eq('id', patient.id);
  }
}
```

- [ ] **Step 2: 배치 UPDATE로 변경**

```typescript
// 퇴원 대상 환자 ID 수집
const dischargeIds = Array.from(existingPatients.entries())
  .filter(([idNo]) => /* 퇴원 조건 */)
  .map(([, patient]) => patient.id);

// 한 번의 UPDATE로 처리
if (!options.dryRun && dischargeIds.length > 0) {
  await supabase
    .from('patients')
    .update({ status: 'discharged', updated_at: new Date().toISOString() })
    .in('id', dischargeIds);
}
```

주의: 각 환자별로 discharge 사유(ward_admission vs activity_stop)가 다를 수 있으므로, 사유별로 그룹화하여 2번의 배치 쿼리로 처리.

- [ ] **Step 3: 타입 체크 + 테스트**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/server/services/patient-sync.ts
git commit -m "perf(sync): 퇴원 처리 개별 UPDATE를 배치 처리로 변경"
```

---

### Task 5: React Query invalidation 정밀화

**Files:**
- Modify: `src/features/*/hooks/*.ts` (invalidateQueries 호출부)

- [ ] **Step 1: 현재 invalidation 패턴 확인**

Run: `grep -rn "invalidateQueries" src/features/ --include="*.ts" --include="*.tsx"`

- [ ] **Step 2: 과도한 invalidation 식별**

패턴 A (너무 넓음):
```typescript
queryClient.invalidateQueries({ queryKey: ['admin'] });
```

패턴 B (적절함):
```typescript
queryClient.invalidateQueries({ queryKey: ['admin', 'patients', 'list'] });
```

- [ ] **Step 3: queryKey 세분화**

각 hook의 useQuery에서 사용하는 queryKey를 상수로 추출:

```typescript
// src/features/admin/hooks/query-keys.ts
export const adminKeys = {
  all: ['admin'] as const,
  patients: {
    all: ['admin', 'patients'] as const,
    list: (filters?: Record<string, unknown>) => ['admin', 'patients', 'list', filters] as const,
    detail: (id: string) => ['admin', 'patients', 'detail', id] as const,
  },
  staff: {
    all: ['admin', 'staff'] as const,
    list: () => ['admin', 'staff', 'list'] as const,
  },
} as const;
```

- [ ] **Step 4: invalidation을 정확한 키로 변경**

mutation의 onSuccess에서:
```typescript
// Before
queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });

// After
queryClient.invalidateQueries({ queryKey: adminKeys.staff.list() });
```

- [ ] **Step 5: 타입 체크 + 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/features/*/hooks/
git commit -m "perf(query): React Query invalidation 정밀화 및 queryKey 상수 추출"
```

---

### Task 6: 최종 검증

- [ ] **Step 1: 불필요한 쿼리 패턴 재확인**

Run: `grep -rn "Promise.all" src/features/*/backend/service.ts` — 동일 테이블 중복 쿼리 없는지 확인.

- [ ] **Step 2: 전체 빌드 + 테스트**

Run: `npm run build && npm test -- --run`
Expected: PASS

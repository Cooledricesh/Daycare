# Phase 3: 코드 중복 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff/Nurse/Doctor 서비스에 산재한 task completion, message CRUD, patient detail 쿼리 중복을 공통 서비스로 통합한다.

**Architecture:** 이미 `src/server/services/task.ts`와 `message.ts`에 공통 로직이 추출되어 있으나, 각 feature 서비스에서 wrapper 함수가 error remapping만 하면서 중복되고 있다. Error remapping을 공통 서비스 레벨에서 처리하도록 개선하고, 반복되는 patient detail 쿼리 패턴을 공통 함수로 추출한다.

**Tech Stack:** TypeScript, Supabase

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/server/services/task.ts` | 에러 매핑 콜백 파라미터 추가 |
| Modify | `src/server/services/message.ts` | 에러 매핑 콜백 파라미터 추가 |
| Create | `src/server/services/patient-detail.ts` | 공통 patient detail 쿼리 |
| Modify | `src/features/staff/backend/service.ts` | 중복 wrapper 제거, 공통 서비스 호출 |
| Modify | `src/features/nurse/backend/service.ts` | 중복 wrapper 제거, 공통 서비스 호출 |
| Modify | `src/features/doctor/backend/service.ts` | 공통 patient detail 사용 |
| Create | `src/server/services/patient-detail.test.ts` | 공통 쿼리 테스트 |

---

### Task 1: Task completion wrapper 중복 제거

**Files:**
- Modify: `src/server/services/task.ts`
- Modify: `src/features/staff/backend/service.ts:311-335`
- Modify: `src/features/nurse/backend/service.ts:220-233`

**분석:** Staff와 Nurse의 `completeTask`는 동일한 구조:
1. `completeTaskShared()` 호출 (role만 다름)
2. `TaskError` → feature-specific error로 remapping

- [ ] **Step 1: 현재 staff/nurse의 completeTask wrapper 확인**

Run: `grep -n "completeTask" src/features/staff/backend/service.ts src/features/nurse/backend/service.ts`
각 wrapper의 정확한 라인 범위를 확인한다.

- [ ] **Step 2: task.ts에 에러 매핑 옵션 추가**

`src/server/services/task.ts`의 `completeTask` 함수에 선택적 에러 변환 콜백을 추가:

```typescript
export interface CompleteTaskOptions {
  consultation_id: string;
  memo?: string;
  mapError?: (error: TaskError) => Error;
}

export async function completeTask(
  supabase: SupabaseClient<Database>,
  staffId: string,
  role: TaskRole,
  params: CompleteTaskOptions,
): Promise<TaskCompletionResult> {
  try {
    // ... 기존 로직 그대로
  } catch (error) {
    if (error instanceof TaskError && params.mapError) {
      throw params.mapError(error);
    }
    throw error;
  }
}
```

- [ ] **Step 3: staff service에서 wrapper 제거**

`src/features/staff/backend/service.ts`의 `completeTask` wrapper를 단순화:

```typescript
import { completeTask as completeTaskShared, TaskError } from '@/server/services/task';

export async function completeTask(
  supabase: SupabaseClient<Database>,
  staffId: string,
  params: CompleteTaskRequest,
): Promise<TaskCompletion> {
  return completeTaskShared(supabase, staffId, 'coordinator', {
    consultation_id: params.consultation_id,
    memo: params.memo,
    mapError: (err) => {
      const codeMap: Record<string, StaffErrorCode> = {
        TASK_NOT_FOUND: StaffErrorCode.TASK_NOT_FOUND,
        TASK_ALREADY_COMPLETED: StaffErrorCode.TASK_ALREADY_COMPLETED,
        TASK_UPDATE_FAILED: StaffErrorCode.INVALID_REQUEST,
      };
      return new StaffError(codeMap[err.code] ?? StaffErrorCode.INVALID_REQUEST, err.message);
    },
  });
}
```

- [ ] **Step 4: nurse service에서 동일하게 적용**

`src/features/nurse/backend/service.ts`의 `completeTask` wrapper를 동일 패턴으로 단순화. role을 `'nurse'`로 변경.

- [ ] **Step 5: 타입 체크 + 테스트 실행**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/server/services/task.ts src/features/staff/backend/service.ts src/features/nurse/backend/service.ts
git commit -m "refactor(task): task completion wrapper 중복 제거"
```

---

### Task 2: Message CRUD wrapper 중복 제거

**Files:**
- Modify: `src/features/staff/backend/service.ts`
- Modify: `src/features/nurse/backend/service.ts`
- Modify: `src/features/doctor/backend/service.ts`

**분석:** Staff, Nurse, Doctor 모두 createMessage/deleteMessage/updateMessage를 wrapper로 호출하면서 feature-specific error로 remapping만 한다.

- [ ] **Step 1: 각 feature의 message wrapper 확인**

Run: `grep -n "createMessage\|deleteMessage\|updateMessage" src/features/staff/backend/service.ts src/features/nurse/backend/service.ts src/features/doctor/backend/service.ts`

- [ ] **Step 2: message.ts에 에러 매핑 옵션 추가**

`src/server/services/message.ts`의 각 함수에 선택적 `mapError` 콜백 추가 (Task 1과 동일 패턴):

```typescript
export interface MessageOptions {
  mapError?: (error: MessageError) => Error;
}
```

각 함수의 catch 블록에서:
```typescript
if (error instanceof MessageError && options?.mapError) {
  throw options.mapError(error);
}
throw error;
```

- [ ] **Step 3: 각 feature service에서 message wrapper 단순화**

Staff, Nurse, Doctor 모두 동일 패턴 적용 — 기존의 try/catch + error remapping 대신 `mapError` 콜백 전달.

- [ ] **Step 4: 타입 체크 + 테스트 실행**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/server/services/message.ts src/features/staff/backend/service.ts src/features/nurse/backend/service.ts src/features/doctor/backend/service.ts
git commit -m "refactor(message): message CRUD wrapper 중복 제거"
```

---

### Task 3: Patient detail 공통 쿼리 추출

**Files:**
- Create: `src/server/services/patient-detail.ts`
- Modify: `src/features/staff/backend/service.ts`
- Modify: `src/features/doctor/backend/service.ts`

**분석:** Staff `getPatientDetail`과 Doctor `getDoctorWaitingPatients`에서 동일한 패턴 반복:
1. patient 기본 정보 쿼리
2. attendance 쿼리 (날짜별)
3. consultation + task_completions 쿼리
4. vitals 쿼리

- [ ] **Step 1: 공통 patient detail 서비스 생성**

```typescript
// src/server/services/patient-detail.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface PatientDayDetail {
  attendance: { checked_at: string } | null;
  consultation: {
    id: string;
    note: string | null;
    has_task: boolean;
    task_content: string | null;
    task_completions: Array<{
      id: string;
      role: string;
      is_completed: boolean;
      completed_at: string | null;
      memo: string | null;
    }>;
  } | null;
  vitals: {
    systolic: number | null;
    diastolic: number | null;
    blood_sugar: number | null;
  } | null;
}

/**
 * 특정 환자의 특정 날짜 상세 정보를 조회한다.
 * Staff, Doctor, Nurse에서 공통으로 사용.
 */
export async function getPatientDayDetail(
  supabase: SupabaseClient<Database>,
  patientId: string,
  date: string,
): Promise<PatientDayDetail> {
  const [
    { data: attendance },
    { data: consultation },
    { data: vitals },
  ] = await Promise.all([
    supabase
      .from('attendances')
      .select('checked_at')
      .eq('patient_id', patientId)
      .eq('date', date)
      .maybeSingle(),
    supabase
      .from('consultations')
      .select('id, note, has_task, task_content, task_completions(id, role, is_completed, completed_at, memo)')
      .eq('patient_id', patientId)
      .eq('date', date)
      .maybeSingle(),
    supabase
      .from('vitals')
      .select('systolic, diastolic, blood_sugar')
      .eq('patient_id', patientId)
      .eq('date', date)
      .maybeSingle(),
  ]);

  return { attendance, consultation, vitals };
}
```

- [ ] **Step 2: staff service에서 공통 함수 사용**

`getPatientDetail`의 개별 쿼리 3개를 `getPatientDayDetail()` 호출로 교체.

- [ ] **Step 3: doctor service에서 공통 함수 사용**

`getDoctorWaitingPatients`의 환자별 상세 조회를 `getPatientDayDetail()` 호출로 교체.

- [ ] **Step 4: 타입 체크 + 테스트 실행**

Run: `npx tsc --noEmit && npm test -- --run`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/server/services/patient-detail.ts src/features/staff/backend/service.ts src/features/doctor/backend/service.ts
git commit -m "refactor(patient): patient detail 쿼리 공통 서비스 추출"
```

---

### Task 4: 최종 검증

- [ ] **Step 1: 중복 패턴 재확인**

Run: `grep -c "supabase.from('attendances')" src/features/*/backend/service.ts`
동일 쿼리가 2곳 이상에서 반복되지 않는지 확인.

- [ ] **Step 2: 전체 빌드 + 테스트**

Run: `npm run build && npm test -- --run`
Expected: PASS

- [ ] **Step 3: 커밋 (필요시)**

남은 항목 수정 후 커밋.

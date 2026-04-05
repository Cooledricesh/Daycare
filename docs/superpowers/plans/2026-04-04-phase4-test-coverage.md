# Phase 4: 테스트 커버리지 확대 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 핵심 서비스 파일에 대한 unit 테스트를 추가하여 리팩토링 안전망을 확보한다. P0(인증/권한) → P1(핵심 서비스) 순으로 진행.

**Architecture:** 기존 `patient/backend/service.test.ts`의 Supabase mock 패턴을 따른다. 각 서비스 함수의 정상 경로와 에러 경로를 테스트한다. Vitest 사용.

**Tech Stack:** Vitest, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/auth.test.ts` | JWT 인증 함수 테스트 (이미 존재하면 보강) |
| Create | `src/server/services/task.test.ts` | 공통 task completion 테스트 |
| Create | `src/server/services/message.test.ts` | 공통 message CRUD 테스트 |
| Create | `src/features/nurse/backend/service.test.ts` | 간호사 서비스 테스트 |
| Create | `src/features/doctor/backend/service.test.ts` | 의사 서비스 핵심 함수 테스트 |
| Create | `src/features/admin/backend/service.test.ts` | 관리자 서비스 핵심 함수 테스트 |
| Create | `src/features/staff/backend/service.test.ts` | 코디네이터 서비스 핵심 함수 테스트 |

---

### Task 1: Supabase Mock 헬퍼 추출

**Files:**
- Create: `src/test-utils/supabase-mock.ts`

**분석:** `patient/backend/service.test.ts`에 mock builder가 있으나 재사용 불가능한 형태. 공통 헬퍼로 추출.

- [ ] **Step 1: 기존 mock 패턴 확인**

`src/features/patient/backend/service.test.ts:17-60`의 `createMockSupabaseBuilder` 패턴을 확인한다.

- [ ] **Step 2: 공통 mock 헬퍼 생성**

```typescript
// src/test-utils/supabase-mock.ts
import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface MockSupabaseChain {
  supabase: SupabaseClient<Database>;
  mockFrom: ReturnType<typeof vi.fn>;
  mockSelect: ReturnType<typeof vi.fn>;
  mockInsert: ReturnType<typeof vi.fn>;
  mockUpdate: ReturnType<typeof vi.fn>;
  mockDelete: ReturnType<typeof vi.fn>;
  mockUpsert: ReturnType<typeof vi.fn>;
  mockEq: ReturnType<typeof vi.fn>;
  mockSingle: ReturnType<typeof vi.fn>;
  mockMaybeSingle: ReturnType<typeof vi.fn>;
  mockOrder: ReturnType<typeof vi.fn>;
  mockLimit: ReturnType<typeof vi.fn>;
  mockRpc: ReturnType<typeof vi.fn>;
  /** 체인 끝에서 반환할 결과를 설정 */
  setResult: (data: unknown, error?: { message: string } | null) => void;
}

export function createMockSupabase(): MockSupabaseChain {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockUpsert = vi.fn();
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockRpc = vi.fn();

  let result = { data: null as unknown, error: null as { message: string } | null };

  const chain = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    upsert: mockUpsert,
    eq: mockEq,
    neq: mockEq,
    in: mockEq,
    gte: mockEq,
    lte: mockEq,
    ilike: mockEq,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  };

  // 모든 체이닝 메서드가 chain 자신을 반환
  for (const mock of [mockSelect, mockInsert, mockUpdate, mockDelete, mockUpsert, mockEq, mockOrder, mockLimit]) {
    mock.mockReturnValue(chain);
  }

  // 종결 메서드는 result를 반환
  mockSingle.mockImplementation(() => result);
  mockMaybeSingle.mockImplementation(() => result);
  mockLimit.mockImplementation(() => result);
  mockOrder.mockImplementation(() => ({ ...chain, then: undefined, ...result }));

  mockFrom.mockReturnValue(chain);
  mockRpc.mockImplementation(() => result);

  const supabase = {
    from: mockFrom,
    rpc: mockRpc,
  } as unknown as SupabaseClient<Database>;

  return {
    supabase,
    mockFrom, mockSelect, mockInsert, mockUpdate, mockDelete, mockUpsert,
    mockEq, mockSingle, mockMaybeSingle, mockOrder, mockLimit, mockRpc,
    setResult: (data, error = null) => { result = { data, error }; },
  };
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/test-utils/supabase-mock.ts
git commit -m "test(utils): Supabase mock 헬퍼 추출"
```

---

### Task 2: 공통 서비스 테스트 — task.ts

**Files:**
- Create: `src/server/services/task.test.ts`
- Reference: `src/server/services/task.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// src/server/services/task.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { completeTask, TaskError } from './task';
import { createMockSupabase, type MockSupabaseChain } from '@/test-utils/supabase-mock';

describe('completeTask', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('정상적으로 task를 완료한다', async () => {
    // maybeSingle: task_completion 존재 + is_completed: false
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: { id: 'tc-1', is_completed: false },
      error: null,
    });
    // single: 업데이트 결과
    mock.mockSingle.mockReturnValueOnce({
      data: {
        id: 'tc-1',
        consultation_id: 'cons-1',
        is_completed: true,
        completed_at: '2026-04-04T00:00:00Z',
        memo: null,
      },
      error: null,
    });

    const result = await completeTask(mock.supabase, 'staff-1', 'coordinator', {
      consultation_id: 'cons-1',
    });

    expect(result.is_completed).toBe(true);
    expect(result.id).toBe('tc-1');
  });

  it('존재하지 않는 task이면 TASK_NOT_FOUND 에러', async () => {
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: null,
      error: null,
    });

    await expect(
      completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-999',
      }),
    ).rejects.toThrow(TaskError);
  });

  it('이미 완료된 task이면 TASK_ALREADY_COMPLETED 에러', async () => {
    mock.mockMaybeSingle.mockReturnValueOnce({
      data: { id: 'tc-1', is_completed: true },
      error: null,
    });

    await expect(
      completeTask(mock.supabase, 'staff-1', 'coordinator', {
        consultation_id: 'cons-1',
      }),
    ).rejects.toThrow(TaskError);
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `npm test -- --run src/server/services/task.test.ts`
Expected: mock 체이닝 문제가 있을 수 있음 — 수정 후 PASS

- [ ] **Step 3: 커밋**

```bash
git add src/server/services/task.test.ts
git commit -m "test(task): 공통 task completion 서비스 테스트 추가"
```

---

### Task 3: 공통 서비스 테스트 — message.ts

**Files:**
- Create: `src/server/services/message.test.ts`
- Reference: `src/server/services/message.ts`

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// src/server/services/message.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMessage, deleteMessage, updateMessage, MessageError } from './message';
import { createMockSupabase, type MockSupabaseChain } from '@/test-utils/supabase-mock';

describe('createMessage', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('전달사항을 생성한다', async () => {
    mock.mockSingle.mockReturnValueOnce({
      data: {
        id: 'msg-1',
        patient_id: 'p-1',
        date: '2026-04-04',
        content: '테스트 메시지',
        is_read: false,
        created_at: '2026-04-04T00:00:00Z',
      },
      error: null,
    });

    const result = await createMessage(mock.supabase, 'staff-1', 'coordinator', {
      patient_id: 'p-1',
      date: '2026-04-04',
      content: '테스트 메시지',
    });

    expect(result.id).toBe('msg-1');
    expect(result.content).toBe('테스트 메시지');
  });

  it('저장 실패 시 MESSAGE_SAVE_FAILED 에러', async () => {
    mock.mockSingle.mockReturnValueOnce({
      data: null,
      error: { message: 'insert failed' },
    });

    await expect(
      createMessage(mock.supabase, 'staff-1', 'coordinator', {
        patient_id: 'p-1',
        date: '2026-04-04',
        content: '테스트',
      }),
    ).rejects.toThrow(MessageError);
  });
});

describe('deleteMessage', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('본인 메시지를 삭제한다', async () => {
    // delete().eq().eq().select() 체인 결과
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [{ id: 'msg-1' }], error: null }),
    });

    await expect(
      deleteMessage(mock.supabase, 'msg-1', 'staff-1'),
    ).resolves.toBeUndefined();
  });

  it('타인 메시지 삭제 시 MESSAGE_NOT_OWNED 에러', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [], error: null }),
    });

    await expect(
      deleteMessage(mock.supabase, 'msg-1', 'staff-other'),
    ).rejects.toThrow(MessageError);
  });
});

describe('updateMessage', () => {
  let mock: MockSupabaseChain;

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it('본인 메시지를 수정한다', async () => {
    mock.mockEq.mockReturnValue({
      eq: mock.mockEq,
      select: () => ({ data: [{ id: 'msg-1' }], error: null }),
    });

    await expect(
      updateMessage(mock.supabase, 'msg-1', 'staff-1', false, { content: '수정됨' }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `npm test -- --run src/server/services/message.test.ts`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/server/services/message.test.ts
git commit -m "test(message): 공통 message CRUD 서비스 테스트 추가"
```

---

### Task 4: auth 테스트 보강

**Files:**
- Modify or Create: `src/lib/auth.test.ts`
- Reference: `src/lib/auth.ts`

- [ ] **Step 1: 기존 auth.test.ts 확인**

Run: `cat src/lib/auth.test.ts` — 현재 커버리지 확인.

- [ ] **Step 2: 누락 케이스 추가**

auth.ts의 각 exported 함수에 대해:
- 정상 토큰 생성/검증
- 만료된 토큰 검증
- 잘못된 시크릿으로 검증
- 역할별 권한 체크

구체적인 테스트 코드는 auth.ts의 export 함수 확인 후 작성.

- [ ] **Step 3: 테스트 실행**

Run: `npm test -- --run src/lib/auth.test.ts`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/lib/auth.test.ts
git commit -m "test(auth): 인증 함수 테스트 보강"
```

---

### Task 5: Nurse 서비스 테스트

**Files:**
- Create: `src/features/nurse/backend/service.test.ts`
- Reference: `src/features/nurse/backend/service.ts`

- [ ] **Step 1: 주요 함수 목록 확인**

Run: `grep -n "^export async function" src/features/nurse/backend/service.ts`
각 함수의 시그니처와 반환 타입을 확인.

- [ ] **Step 2: getNursePatients 테스트 작성**

정상 경로: 출석한 환자 목록 반환
에러 경로: 쿼리 실패 시 에러

- [ ] **Step 3: completeTask 테스트 작성**

(공통 서비스를 호출하므로, error remapping이 제대로 되는지만 확인)

- [ ] **Step 4: 테스트 실행**

Run: `npm test -- --run src/features/nurse/backend/service.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/nurse/backend/service.test.ts
git commit -m "test(nurse): 간호사 서비스 테스트 추가"
```

---

### Task 6: Doctor 서비스 핵심 함수 테스트

**Files:**
- Create: `src/features/doctor/backend/service.test.ts`
- Reference: `src/features/doctor/backend/service.ts`

- [ ] **Step 1: 주요 함수 목록 확인**

Run: `grep -n "^export async function" src/features/doctor/backend/service.ts`

- [ ] **Step 2: 핵심 함수 테스트 작성**

최소 다음 함수 커버:
- `createConsultation` — 진찰 기록 생성 + task_completions 연동
- `getDoctorWaitingPatients` — 대기 환자 목록
- `getDoctorTaskStats` — 처리 통계

각 함수의 정상/에러 경로.

- [ ] **Step 3: 테스트 실행**

Run: `npm test -- --run src/features/doctor/backend/service.test.ts`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/features/doctor/backend/service.test.ts
git commit -m "test(doctor): 의사 서비스 핵심 함수 테스트 추가"
```

---

### Task 7: 커버리지 측정 + 목표 설정

- [ ] **Step 1: 커버리지 실행**

Run: `npm test -- --run --coverage`
Expected: 커버리지 리포트 출력

- [ ] **Step 2: 결과 확인**

서비스 파일별 커버리지 확인. 목표: 공통 서비스 80%+, feature 서비스 핵심 함수 60%+.

- [ ] **Step 3: 결과 기록**

improvement-plan.md의 Phase 4 섹션에 현재 커버리지 수치를 업데이트.

# Plan Dispatch - Plan의 특정 Task를 Implementer에 디스패치

## Usage
```
/plan-dispatch [plan-file-path] [task-number]
```

예시:
```
/plan-dispatch docs/superpowers/plans/2026-04-11-experimental-features.md 7
/plan-dispatch docs/superpowers/plans/foo.md 3
```

## What This Does

이미 작성된 plan 파일에서 지정된 Task 하나를 추출하여 `implementer` subagent에 디스패치하는 micro-orchestrator입니다. `superpowers:subagent-driven-development` 스킬이 "plan 전체를 세션 초기에 로드해 오케스트레이션"하는 macro 레이어라면, 이 명령어는 "이미 진행 중인 세션에서 다음 Task 하나만 지금 실행"하는 micro 레이어입니다.

## 배경

- 각 Task마다 TodoWrite(in_progress) → plan에서 Task 텍스트 수동 추출 → Agent(implementer) 호출 → 완료 보고 → TodoWrite(completed) 반복이 발생한다.
- 이 scaffold가 22 Tasks 세션에서 반복되면 컨텍스트 추출 실수/누락이 생긴다.
- 이 명령어는 plan 파일 경로 + Task 번호만으로 전체 루프를 자동화한다.

## Process

### Step 1: 인자 파싱
```
$ARGUMENTS 에서 plan 파일 경로와 Task 번호를 추출합니다.
- 첫 번째 토큰: plan 파일 경로
- 두 번째 토큰: Task 번호 (정수)

파싱 실패 시 사용자에게 정확한 사용법을 Korean으로 안내하고 종료.
```

### Step 2: Plan 파일 읽기 및 Task 블록 추출
```
1. Read tool로 plan 파일 전체를 읽습니다.
2. "### Task N:" 패턴으로 해당 Task 블록을 식별합니다 (N은 지정된 번호).
3. 다음 "### Task N+1:" 또는 "## Phase"가 나오기 직전까지가 해당 Task의 전체 범위입니다.
4. 해당 범위의 모든 줄(제목, Files, Steps, 코드 블록, Acceptance criteria)을 문자열로 추출합니다.
5. Task가 없으면 Korean 에러 메시지와 함께 종료.
```

### Step 3: TodoWrite 상태 동기화
```
1. TaskList로 현재 todo를 조회합니다.
2. "T{N}" 또는 "Task {N}" 제목의 기존 todo가 있으면 `in_progress`로 업데이트합니다.
3. 없으면 Task 제목(추출한 "### Task N: 제목" 라인)으로 TaskCreate → in_progress 마킹합니다.
```

### Step 4: Implementer subagent 디스패치
```
Agent tool을 subagent_type="implementer"로 호출합니다.

prompt 구성:
---
You are executing Task {N} of the plan at `{plan_file_path}`. Branch: {current_branch}. CWD: {project_root}.

**Context:** (plan 파일 상단 2-3줄에서 Goal/Architecture 발췌)

**Task {N} — (추출한 Task 제목)**

(추출한 Task 블록 전체를 그대로 삽입)

**Reporting format:**
```
STATUS: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
Files modified/created: ...
Verification: ...
Commit SHA: ...
Concerns: ...
```

Start now.
---

호출 후 subagent 보고를 대기합니다.
```

### Step 5: Subagent 보고 처리
```
보고 수신 후 STATUS 분기:

- **DONE**: Step 6으로 진행
- **DONE_WITH_CONCERNS**: concerns 사용자에게 Korean으로 표시 후 Step 6으로 진행
- **NEEDS_CONTEXT**: 사용자에게 누락된 컨텍스트를 Korean으로 안내하고 종료 (사용자가 추가 정보 제공 후 재실행 필요)
- **BLOCKED**: 사용자에게 blocker를 Korean으로 표시하고 종료
```

### Step 6: 검증 및 마무리
```
1. Bash tool로 `npx tsc --noEmit` 실행해 타입 오류 없음 확인.
2. 타입 오류가 있으면 사용자에게 Korean으로 알리고 TodoWrite는 in_progress 유지.
3. 타입 오류가 없으면 TaskUpdate로 해당 todo를 `completed`로 마킹.
4. 최근 커밋 해시(`git log -1 --format='%h %s'`)를 Korean 요약으로 출력.
```

## Output Format (Korean)

```markdown
## 📋 T{N} 디스패치 시작

**Plan**: {plan_file_path}
**Task**: {Task 제목}

---

[implementer subagent 호출 진행 상황]

---

## ✅ T{N} 완료

- **Status**: {DONE|DONE_WITH_CONCERNS|...}
- **Commit**: {short_sha} {커밋 메시지}
- **TypeScript**: {pass/fail}
- **Files**: [수정/생성 파일 요약]
- **Concerns**: {있으면 표시}

TodoWrite 상태: `completed`
```

## 🚨 Error Handling

### Plan 파일을 찾을 수 없음
```markdown
## ⚠️ Plan 파일 없음

`{path}`를 찾을 수 없습니다. 경로를 확인해주세요.

사용법:
```
/plan-dispatch [plan-file-path] [task-number]
```
```

### Task 번호가 범위 밖
```markdown
## ⚠️ Task 없음

Plan에 Task {N}이 정의되어 있지 않습니다.

Plan의 Task 목록:
- Task 1: ...
- Task 2: ...
...

다시 시도하려면 유효한 번호로 호출해주세요.
```

### Implementer가 BLOCKED 반환
```markdown
## 🛑 T{N} 블록됨

Implementer가 다음 이유로 작업을 완료할 수 없습니다:
{blocker 내용}

해결 옵션:
1. 누락된 컨텍스트 제공 후 재실행
2. Task를 더 작은 단위로 쪼개기
3. Plan 자체를 수정
```

## 📋 중요 사항

1. **한국어로 출력** — 모든 사용자 대상 출력은 Korean
2. **Subagent는 한 번에 하나만** — 동시 다중 디스패치 금지 (파일 충돌)
3. **Plan 파일 무변경** — 읽기만 하고 수정하지 않음
4. **커밋은 implementer가 책임** — 오케스트레이터는 커밋하지 않음
5. **타입 체크는 반드시 실행** — `npx tsc --noEmit` 통과 확인 후에만 todo completed
6. **BLOCKED 재시도 금지** — 같은 모델/같은 프롬프트로 자동 재시도하지 않음. 사용자가 상황을 바꿔서 재호출해야 함.

## 🎯 Success Criteria

명령어가 성공하려면:
- ✅ Plan 파일과 Task 번호 파싱 성공
- ✅ Task 블록 추출 성공
- ✅ Implementer subagent 호출 성공
- ✅ STATUS가 DONE 또는 DONE_WITH_CONCERNS
- ✅ `npx tsc --noEmit` 통과
- ✅ TodoWrite completed 마킹 완료

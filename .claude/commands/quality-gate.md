# Quality Gate - TypeScript / Test / Build 검증 게이트

## Usage
```
/quality-gate [--level=tsc|test|full]
```

예시:
```
/quality-gate              # 기본 level=test (tsc + vitest)
/quality-gate --level=tsc  # 타입 체크만
/quality-gate --level=full # tsc + vitest + build (Phase 완료/merge 전)
```

## What This Does

Daycare 프로젝트의 품질 검증을 일관된 레벨로 실행합니다. Task마다 개별적으로 `tsc`만 돌리거나, 일부는 `test`를 함께 돌리는 식으로 혼재되어 빠지는 검증 단계가 다음 Task로 넘어가 빌드 에러로 뒤늦게 발견되는 사례를 방지합니다.

이 명령어는 thin orchestrator이며, 발견된 오류가 있을 때는 사용자에게 상세 로그를 제시하고 수정 권고만 합니다. 자동 수정은 하지 않습니다 (수정이 필요하면 `quality_checker` agent를 직접 호출).

## 레벨

| Level | 실행 내용 | 사용 시점 |
|-------|-----------|-----------|
| `tsc` | `npx tsc --noEmit` | 작은 편집 후 즉시 확인 |
| `test` (default) | `tsc` + `npm test -- --run` | Task 완료 직후 |
| `full` | `tsc` + `test` + `npm run build` | Phase 완료 / merge 전 / 릴리즈 전 |

인수 없이 호출하면 `test` 레벨로 실행합니다.

## Process

### Step 1: 인자 파싱
```
$ARGUMENTS에서 --level 플래그를 파싱합니다.
- 없으면 기본값 "test"
- 값이 tsc/test/full 외이면 Korean 에러 메시지로 사용법 안내 후 종료
```

### Step 2: TypeScript Check (모든 레벨에서 실행)
```
Bash tool로 실행: `npx tsc --noEmit`

- timeout: 120000ms
- stdout + stderr 모두 캡처
- exit code 0이 아니면 "FAIL", 에러 카운트 추출 (grep으로 "error TS" 개수 또는 "Found N errors" 파싱)
```

### Step 3: Unit Tests (level=test 이상)
```
Bash tool로 실행: `npm test -- --run`

- timeout: 180000ms
- 결과에서 `Test Files`, `Tests` 줄 추출 (passed/failed 카운트)
- exit code 0이 아니면 "FAIL", 실패 테스트 목록 첫 5개 추출
```

### Step 4: Production Build (level=full)
```
Bash tool로 실행: `npm run build`

- timeout: 300000ms
- stdout 끝 30줄 캡처
- "Failed to compile" 또는 non-zero exit → "FAIL"
- 성공 시 "Compiled successfully" + 빌드 시간 추출
```

### Step 5: 결과 통합 및 리포트
```
각 단계의 결과를 다음 Korean 포맷으로 출력:
```

## Output Format (Korean)

### 성공 케이스 (level=full 예시)
```markdown
## 🟢 Quality Gate 통과 (level=full)

| 단계 | 결과 | 비고 |
|------|------|------|
| TypeScript | ✅ PASS | 0 errors |
| Unit Tests | ✅ PASS | 93/93 tests in 10 files |
| Production Build | ✅ PASS | 2.1s, 32 routes |

모든 검증을 통과했습니다. 다음 단계로 진행할 수 있습니다.
```

### 실패 케이스 (TypeScript 오류 발생)
```markdown
## 🔴 Quality Gate 실패 (level=test)

| 단계 | 결과 | 비고 |
|------|------|------|
| TypeScript | ❌ FAIL | 3 errors |
| Unit Tests | ⏸️ SKIPPED | 이전 단계 실패 |

### TypeScript 오류 상세
```
src/features/foo/service.ts:42:15 - error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/features/foo/service.ts:58:20 - error TS2322: Type 'undefined' is not assignable to type 'number'.
...
```

### 권장 조치
1. 오류 위치를 직접 수정
2. 복잡한 경우 `quality_checker` agent 호출하여 자동 수정 시도:
   ```
   Agent(subagent_type="quality_checker", prompt="현재 브랜치의 tsc 오류 수정")
   ```
3. 수정 후 `/quality-gate --level=test` 재실행
```

### 실패 케이스 (Unit Test 실패)
```markdown
## 🔴 Quality Gate 실패 (level=test)

| 단계 | 결과 | 비고 |
|------|------|------|
| TypeScript | ✅ PASS | 0 errors |
| Unit Tests | ❌ FAIL | 2/93 failed |

### 실패한 테스트
- `src/features/foo/service.test.ts > should calculate age correctly`
- `src/lib/birthday.test.ts > leap year edge case`

### 권장 조치
1. 실패 테스트를 직접 실행해 로그 확인:
   ```
   npm test src/features/foo/service.test.ts
   ```
2. 구현 또는 테스트 중 어느 쪽 버그인지 판단 후 수정
3. 수정 후 `/quality-gate` 재실행
```

## 🚨 주의사항

### Linting은 포함하지 않음
Next.js 16 환경에서 `npm run lint`가 `Invalid project directory` 오류로 동작하지 않는 문제가 있어 본 게이트에서는 제외합니다. 린트 검사가 필요하면 별도로 `npx eslint src`를 실행하거나 `quality_checker` agent를 호출하세요.

### 자동 수정 안 함
이 명령어는 순수 검증만 수행합니다. 자동 수정은 `quality_checker` agent의 역할입니다. 책임 분리를 통해 검증과 수정의 혼재를 방지합니다.

### 긴 실행 시간
- `test` 레벨: 보통 10-30초
- `full` 레벨: 보통 30-60초 (build 포함)
- 매우 느리거나 타임아웃이 나면 Bash tool timeout을 늘려 재시도 권고

## 📋 중요 사항

1. **한국어로 출력** — 모든 사용자 대상 출력은 Korean
2. **자동 수정 안 함** — 실패 시 권장 조치만 제시, 수정은 사용자 또는 quality_checker agent
3. **SKIPPED 처리** — 이전 단계 실패 시 다음 단계는 SKIPPED로 표시
4. **실패 로그 첨부** — 오류 상세를 요약된 형태로 출력 (전체 로그는 너무 길면 첫 20줄)
5. **린트는 제외** — 본 게이트 범위 외

## 🎯 Success Criteria

Level 별 성공 기준:

- `tsc`: TypeScript 0 errors
- `test`: TypeScript 0 errors + 모든 unit test 통과
- `full`: TypeScript 0 errors + 모든 unit test 통과 + production build 성공

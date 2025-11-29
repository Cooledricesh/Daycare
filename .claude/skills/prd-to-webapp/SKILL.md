---
name: prd-to-webapp
description: "PRD 문서 기반 웹앱 개발 자동화 워크플로우. PRD가 이미 작성되어 있을 때 사용. Subagent(doc-generator, implementer, quality-checker, test-writer, coverage-fixer)를 활용하여 (1) PRD 분석 및 기술 스택 확정, (2) Database/UserFlow 문서 생성, (3) 페이지별 Plan/Spec/Statement 생성, (4) 구현, (5) 품질 검사, (6) 테스트 작성 및 70% 커버리지 달성까지 체계적으로 진행한다. 'PRD로 웹앱 만들어줘', 'PRD 기반 개발', 'PRD 있는데 구현해줘' 등의 요청에 사용."
---

# PRD to WebApp Skill

PRD 문서를 입력으로 받아 웹앱을 체계적으로 구현하는 워크플로우.

## 필수 Subagents

이 스킬은 다음 subagent들을 활용한다. 사용 전 `~/.claude/agents/`에 설치 확인:

| Subagent | 역할 | 호출 시점 |
|----------|------|----------|
| `doc-generator` | Database, UserFlow, Plan, Spec, Statement 문서 생성 | Phase 1, 2 |
| `implementer` | Spec 기반 코드 구현 | Phase 3 |
| `quality-checker` | Type/Lint/Build 검사 및 수정 | Phase 3 후 |
| `test-writer` | 테스트 작성 | Phase 4 |
| `coverage-fixer` | 커버리지 70% 달성 | Phase 4 |

## 워크플로우 개요

```
PRD (docs/prd.md)
    ↓
[Phase 0] 기술 스택 확정 (사용자 확인)
    ↓
[Phase 1] SOT 문서 생성
    ├── Database Design (docs/database.md)
    └── User Flow (docs/userflow.md)
    ↓
[Phase 2] 구현 계획 (페이지별)
    ├── Plan (docs/plans/[page]-plan.md)
    ├── Spec (docs/specs/[page]-spec.md)
    └── Statement (docs/statements/[page]-statement.md)
    ↓
[Phase 3] 구현 + 품질 검사
    ├── 코드 구현
    └── Type/Lint/Build 통과
    ↓
[Phase 4] 테스트
    ├── 테스트 작성
    └── 70% 커버리지 달성
```

## Phase 0: 기술 스택 확정

PRD 분석 후 사용자에게 기술 스택 확인 필수.

### 확인 항목

```
[기술 스택 확인]

PRD 분석 결과:
- Framework: [PRD에서 파악한 내용]
- Database: [PRD에서 파악한 내용]
- Auth: [PRD에서 파악한 내용]
- Styling: [PRD에서 파악한 내용]

제안 기술 스택:
- Framework: Next.js 14+ (App Router)
- Language: TypeScript (strict mode)
- Database: Supabase (PostgreSQL + Auth + Storage)
- Styling: Tailwind CSS
- State: [복잡도에 따라 결정]
- Testing: Vitest + Testing Library
- Validation: Zod

이대로 진행할까요? 변경이 필요하면 말씀해주세요.
```

**사용자 확인 후에만 다음 단계 진행.**

## Phase 1: SOT 문서 생성

Subagent `doc-generator` 호출.

### 실행

```
Task: @doc-generator

PRD 문서(docs/prd.md)를 분석하여 다음 문서를 생성해주세요:

1. Database Design (docs/database.md)
   - ERD 다이어그램
   - 테이블 스키마
   - RLS 정책
   - TypeScript 인터페이스

2. User Flow (docs/userflow.md)
   - 주요 사용자 여정
   - 페이지 전환 흐름
   - 에러 케이스

각 문서 생성 전 구조와 내용을 보고하고 확인받아주세요.
```

### Quality Gate
- 모든 SOT 문서 생성 완료
- 사용자 리뷰 및 승인

## Phase 2: 구현 계획

PRD에서 페이지 목록 추출 후, 각 페이지별로 문서 생성.

### 실행

```
Task: @doc-generator

[Page Name] 페이지에 대한 구현 문서를 생성해주세요:

참조:
- PRD: docs/prd.md
- Database: docs/database.md
- UserFlow: docs/userflow.md

생성할 문서:
1. Plan (docs/plans/[page]-plan.md)
   - 컴포넌트 계층 구조
   - 기능 우선순위 (P0/P1/P2)
   - API 요구사항
   - 구현 순서

2. Spec (docs/specs/[page]-spec.md)
   - 컴포넌트 Props/State 타입
   - API 계약
   - 폼 검증 스키마
   - 에러 핸들링 패턴

3. Statement (docs/statements/[page]-statement.md)
   - 상태 복잡도 점수 (1-10)
   - 상태 관리 권장 방식
   - 상태 구조

각 문서 생성 전 보고해주세요.
```

### Quality Gate
- 모든 페이지의 Plan, Spec, Statement 완료
- 사용자 리뷰 및 승인

## Phase 3: 구현

페이지별로 구현 진행.

### 실행

```
Task: @implementer

[Page Name] 페이지를 구현해주세요.

참조 문서:
- Plan: docs/plans/[page]-plan.md
- Spec: docs/specs/[page]-spec.md
- Statement: docs/statements/[page]-statement.md

구현 전 계획을 보고하고 확인받아주세요.
P0 기능을 먼저 구현하고, P1, P2 순서로 진행해주세요.
```

### 구현 완료 후 품질 검사

```
Task: @quality-checker

구현된 코드에 대해 품질 검사를 진행해주세요:
1. TypeScript 타입 체크
2. ESLint 검사
3. Build 검증

발견된 문제는 보고 후 수정해주세요.
```

### Quality Gate
- 모든 품질 검사 통과 (Type/Lint/Build)
- P0 기능 100% 구현

## Phase 4: 테스트

### 테스트 작성

```
Task: @test-writer

[Page Name] 페이지에 대한 테스트를 작성해주세요.

참조:
- Spec: docs/specs/[page]-spec.md
- 구현 코드

테스트 계획을 보고하고 확인받아주세요.
```

### 커버리지 확인 및 보완

```bash
npm run test:coverage
```

커버리지 70% 미달 시:

```
Task: @coverage-fixer

현재 커버리지가 목표(70%)에 미달합니다.
커버리지 리포트를 분석하고 추가 테스트를 작성해주세요.

분석 결과와 보완 계획을 보고해주세요.
```

### Quality Gate
- 모든 테스트 통과
- 커버리지 70% 이상

## 디렉토리 구조

```
project/
├── docs/
│   ├── prd.md                 # 입력 (사용자 제공)
│   ├── database.md            # Phase 1
│   ├── userflow.md            # Phase 1
│   ├── plans/                 # Phase 2
│   │   └── [page]-plan.md
│   ├── specs/                 # Phase 2
│   │   └── [page]-spec.md
│   └── statements/            # Phase 2
│       └── [page]-statement.md
├── app/                       # Phase 3 (Next.js App Router)
│   └── [page]/
│       └── page.tsx
├── components/                # Phase 3
├── hooks/                     # Phase 3
├── lib/                       # Phase 3
├── types/                     # Phase 3
└── __tests__/                 # Phase 4
```

## 상태 관리 결정 기준

Statement의 복잡도 점수에 따라:

| 점수 | 권장 방식 | 사용 케이스 |
|------|----------|------------|
| 1-3 | useState | 단순 로컬 상태, 폼 입력 |
| 4-6 | useReducer/Context | 복잡한 로컬 상태, 관련 상태 그룹 |
| 7-8 | Zustand | 컴포넌트 간 공유, 중간 복잡도 |
| 9-10 | Redux Toolkit | 전역 상태, 복잡한 사이드 이펙트 |

## 체크리스트

### 시작 전
- [ ] PRD 문서 존재 확인 (docs/prd.md)
- [ ] Subagent 설치 확인 (~/.claude/agents/)
- [ ] Node.js 프로젝트 초기화

### Phase 0
- [ ] PRD 분석 완료
- [ ] 기술 스택 사용자 확인

### Phase 1
- [ ] database.md 생성 및 리뷰
- [ ] userflow.md 생성 및 리뷰

### Phase 2
- [ ] 페이지 목록 확정
- [ ] 각 페이지 Plan 생성
- [ ] 각 페이지 Spec 생성
- [ ] 각 페이지 Statement 생성

### Phase 3
- [ ] 각 페이지 구현 완료
- [ ] Type 체크 통과
- [ ] Lint 통과
- [ ] Build 성공

### Phase 4
- [ ] 테스트 작성 완료
- [ ] 모든 테스트 통과
- [ ] 커버리지 70% 이상

## 문제 해결

### PRD가 불완전할 때
사용자에게 다음 정보 요청:
- 누락된 기능 상세
- 사용자 역할 정의
- 비즈니스 규칙

### 복잡도가 너무 높을 때
- 페이지 분할 제안
- MVP 범위 조정 논의
- 기능 우선순위 재조정

### 테스트 커버리지 달성 어려울 때
- 테스트 불가능한 코드 리팩토링
- 의존성 주입 패턴 적용
- 필요시 istanbul ignore (최소한으로)

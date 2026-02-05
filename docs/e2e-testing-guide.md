# E2E 테스트 가이드 (Playwright)

## 개요

이 문서는 Playwright를 사용하여 브라우저 기반 E2E 테스트를 실행하는 방법을 설명합니다.

## 사전 준비

### 1. 환경 초기화 (필수)

테스트 실행 전 **반드시** 기존 프로세스를 정리해야 합니다:

```bash
# 1. 포트 3000 사용 중인 프로세스 확인 및 종료
lsof -ti :3000 | xargs -r kill -9 2>/dev/null

# 2. 남은 Next.js 프로세스 종료
pkill -9 -f "next dev" 2>/dev/null

# 3. Next.js lock 파일 제거
rm -rf .next/dev/lock 2>/dev/null

# 4. 포트 사용 가능 확인
lsof -i :3000 | grep LISTEN || echo "포트 3000 사용 가능"
```

### 2. Dev 서버 시작

```bash
# 백그라운드에서 dev 서버 시작
npm run dev > /tmp/nextjs-dev.log 2>&1 &

# 서버 준비 대기 (약 5-8초)
sleep 8

# 서버 상태 확인
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/login
```

**서버 로그 확인:**
```bash
tail -20 /tmp/nextjs-dev.log
```

### 3. 서버 접속 테스트

```bash
# 간단한 접속 테스트
curl -s http://localhost:3000/login | grep -o "<title>[^<]*</title>"
```

## 테스트 실행

### 기본 실행 (Headless)

```bash
npx playwright test
```

### Headed 모드 (브라우저 표시)

```bash
npx playwright test --headed
```

### 특정 테스트 파일 실행

```bash
npx playwright test e2e/room-mapping-sync.spec.ts --headed
```

### 특정 브라우저에서 실행

```bash
npx playwright test --project=chromium --headed
```

### UI 모드 (디버깅에 유용)

```bash
npx playwright test --ui
```

## 테스트 작성 가이드

### 기본 구조

```typescript
import { test, expect } from '@playwright/test';

test.describe('기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto('/login');
    await page.getByLabel('아이디').fill('admin');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인' }).click();

    // 로그인 완료 대기
    await page.waitForURL(/\/(admin|staff|doctor|nurse)/, { timeout: 10000 });
  });

  test('테스트 케이스', async ({ page }) => {
    // 테스트 로직
  });
});
```

### 로그인 정보

| 계정 | ID | Password | Role |
|------|-----|----------|------|
| 관리자 | admin | 1234 | admin |

### Selector 사용 가이드

**권장하는 방식:**
```typescript
// Role 기반 (가장 권장)
page.getByRole('button', { name: '로그인' })
page.getByRole('heading', { name: '스케줄 관리' })

// Label 기반
page.getByLabel('아이디')
page.getByLabel('비밀번호')

// Text 기반
page.getByText('환자 관리')

// Test ID 기반
page.getByTestId('submit-button')
```

**피해야 할 방식:**
```typescript
// CSS selector (변경에 취약)
page.locator('.btn-primary')
page.locator('#login-form')
```

### 대기 처리

```typescript
// 특정 URL로 이동 대기
await page.waitForURL('/admin/schedule', { timeout: 10000 });

// 요소 표시 대기
await expect(page.getByRole('heading', { name: '제목' })).toBeVisible({ timeout: 10000 });

// 네트워크 요청 완료 대기
await page.waitForLoadState('networkidle');

// 모달 닫힘 대기
await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
```

## 문제 해결

### 1. 테스트가 실행되지 않음

**증상:** 브라우저가 열리지 않거나 테스트가 시작되지 않음

**해결:**
```bash
# 환경 완전 초기화
pkill -9 -f "next dev"
rm -rf .next/dev/lock
npm run dev &
sleep 10
npx playwright test --headed
```

### 2. 로그인 실패

**증상:** `page.waitForURL: Timeout` 에러

**확인사항:**
- 로그인 계정 정보 확인 (admin / 1234)
- 서버가 정상 동작 중인지 확인
- 스크린샷 확인: `test-results/` 폴더

### 3. Strict Mode Violation

**증상:** `resolved to X elements` 에러

**해결:** 더 구체적인 selector 사용
```typescript
// Bad
page.getByRole('heading')

// Good
page.getByRole('heading', { name: '스케줄 관리' })
```

### 4. Element Not Found

**증상:** 요소를 찾을 수 없음

**해결:**
```typescript
// 타임아웃 증가
await expect(element).toBeVisible({ timeout: 15000 });

// 네트워크 대기 추가
await page.waitForLoadState('networkidle');
```

## 테스트 결과 확인

### 스크린샷 확인

실패한 테스트의 스크린샷:
```bash
ls test-results/
```

### HTML 리포트

```bash
npx playwright show-report
```

### 에러 컨텍스트

실패 시 생성되는 `error-context.md` 파일에서 페이지 상태 확인 가능

## 설정 파일

`playwright.config.ts`:
- `baseURL`: http://localhost:3000
- `testDir`: ./e2e
- `webServer`: 자동으로 `npm run dev` 실행
- `reuseExistingServer`: 기존 서버 재사용 (로컬 개발 시)

## 테스트 파일 위치

```
e2e/
├── home.spec.ts             # 홈 페이지 테스트
├── login.spec.ts            # 로그인 테스트
├── patient-checkin.spec.ts  # 환자 체크인 테스트
├── protected-routes.spec.ts # 보호된 라우트 테스트
├── room-mapping-sync.spec.ts # 호실 매핑 동기화 테스트
├── doctor-tasks.spec.ts     # 의사 처리 필요 항목 테스트
├── doctor-history.spec.ts   # 환자 히스토리 테스트
└── staff-messages.spec.ts   # 전달사항 작성 테스트
```

# 연속출석 확장 · 스트릭 버그 수정 · 주사제 의사화면 표시 — 설계서

작성일: 2026-06-08
대상 프로젝트: Daycare (Next.js + Hono + Supabase), Carescheduler (외부 연동)

---

## 1. 배경 및 목표

세 가지 작업을 한 묶음으로 진행한다.

1. **연속 출석(streak) 버그 수정** — 휴원일(공휴일)이 `holidays` 테이블에 없어 모든 환자의 스트릭이 가장 최근 휴원일에서 끊긴다. 이를 자동 감지 + 공휴일 등록으로 고친다.
2. **연속 출석을 각 직역 대시보드로 확장** — 현재 출석보드에만 보이는 스트릭을 의사/간호사/코디/관리자 대시보드의 환자 목록 카드에 게이미피케이션 뱃지로 노출한다.
3. **주사제 정보를 의사 화면에 표시** — 의사 진료 패널(선택 환자)에 그 환자의 LAI 주사제 이력(어떤 주사를 며칠에 **몇 번째** 맞았는지)과 다음 예정일을 표시한다.

---

## 2. 작업 ① 연속 출석 스트릭 버그 수정

### 2.1 근본 원인 (데이터로 확정)

`holidays` 테이블이 비어 있다. 스트릭 계산(`calculateConsecutiveAttendance`)은 "평일인데 예정일에 미출석 = 결석 → 스트릭 종료" 규칙을 쓰는데, 휴원일이 holidays에 없으면 그날이 평일 예정 결석으로 잡혀 **전 환자의 스트릭이 그 지점에서 끊긴다.**

실측된 미등록 휴원일(전체 출석자 0명 평일):

| 날짜 | 요일 | 전체 출석자 | holidays 등록 | 추정 사유 |
|---|---|---|---|---|
| 2026-06-03 | 수 | 0 | ❌ | 제8회 전국동시지방선거 |
| 2026-05-25 | 월 | 0 | ❌ | 부처님오신날 대체휴일 |
| 2026-05-05 | 화 | 0 | ❌ | 어린이날 |
| 2026-05-01 | 금 | 0 | ❌ | 근로자의 날 |

가장 최근 휴원일(06-03)에서 전원 스트릭이 끊겨, 매일 출석하는 환자도 최대 3일(6/4·6/5·6/8)만 표시된다.

### 2.2 해결 방식 (자동 감지 + 공휴일 등록 병행)

**(a) 자동 감지 (코드)** — 스트릭 계산용 데이터 로딩 시, 윈도우 내 날짜별 전체 출석자 수를 집계해 **"평일 + 전체 출석자 0명 + 오늘 이전"인 날을 휴원일(closure)로 간주**한다. 이 closure 집합을 기존 `holidayMap`과 합쳐(`holiday ∪ autoClosure`) 스트릭 계산의 skip 판정에 사용한다.
- 오늘(endDate)은 자동 closure 대상에서 제외한다. (오전 중 아직 아무도 출석 안 한 상태를 휴원으로 오인하지 않기 위함)
- 부분 출석일(예: 일부만 출석)은 closure 아님 — 0명일 때만.

**(b) 공휴일 등록 (마이그레이션)** — 위 4일을 포함한 한국 공휴일을 `holidays` 테이블에 시드한다. 자동 감지가 과거를 커버하더라도, 미래 휴원일·데이터 없는 날을 위해 표준 공휴일을 채워둔다. 적용은 사용자가 Supabase에 반영한다(프로젝트 규칙).

**핵심 설계 결정**: 스트릭 계산 로직(현재 `attendance-board/backend/service.ts`에만 존재)을 공유 모듈 `src/features/shared/backend/streak.ts`로 추출한다. 자동 closure 감지도 여기에 둔다. 출석보드와 작업 ②의 신규 엔드포인트가 **동일한 단일 구현**을 쓰도록 한다.

### 2.3 영향 범위
- 출석보드(`/api/shared/attendance-board`)의 스트릭이 휴원일을 건너뛰어 정상 이어짐.
- 작업 ②의 신규 스트릭 엔드포인트도 동일 로직 사용.

---

## 3. 작업 ② 연속 출석을 직역 대시보드로 확장

### 3.1 현재 구조의 제약
스트릭 데이터(`attendance_streak`, `consultation_streak`, `streak_tier`)는 출석보드 전용 API에만 있다. 의사/간호사/코디/관리자 대시보드 환자 목록은 각자 다른 API·스키마를 쓰며 스트릭 필드가 없다.

### 3.2 설계 — 공유 배치 엔드포인트 + 프론트 오버레이

4개 역할 서비스를 각각 수정하지 않고(리스크↓, DRY), **단일 공유 엔드포인트**로 스트릭을 제공한다.

- **백엔드**: `GET /api/shared/streaks?date=YYYY-MM-DD` → 활성 환자 전체의 `{ patientId: { attendance_streak, consultation_streak, streak_tier } }` 맵 반환. 내부적으로 2.2의 공유 streak 모듈 사용. (전 환자 계산이므로 출석보드와 동일한 60일 윈도우 로딩 1회.)
  - closure 자동 감지를 위해 날짜별 **전체** 출석 집계가 필요하므로, 요청 환자만이 아니라 전 환자 기준으로 계산한다.
- **프론트**: 신규 훅 `useStreaks(date)` (React Query, 신규 query key). 각 역할 대시보드의 환자 목록 컴포넌트에서 이 훅의 맵을 참조해, 카드에 스트릭 뱃지를 오버레이한다.
  - 역할 서비스/스키마는 **변경하지 않는다.** 환자 카드에 뱃지만 합성.

### 3.3 UI — 게이미피케이션 뱃지 (환자 목록 카드)

출석보드의 화려한 풀 이펙트(오라/파티클/떠있음)는 대시보드 목록엔 과하므로, **압축형 뱃지**를 신설한다. 공용 컴포넌트 `src/features/shared/components/StreakBadge.tsx`.

- 표시 조건: `attendance_streak >= 3` (tier `fire` 이상)일 때만. 그 미만은 뱃지 없음(목록 노이즈 방지).
- 형태: 환자 이름 옆 또는 아바타 모서리에 작은 칩 — `아이콘 + N` (예: 🔥3, ⚡7, 💎12, 👑20, 🌟30).
- 등급 색상/아이콘은 출석보드의 기존 `getStreakTier` / `BADGE_COLORS` 기준을 공용 상수로 추출해 재사용(하드코딩 금지, 단일 출처).
- 접근성: `aria-label`에 "N일 연속 출석" 포함.
- 4개 역할(의사·간호사·코디·관리자) 모두 동일 뱃지 적용.

### 3.4 단일 출처 원칙
tier 임계값(3/5/10/20/30), 아이콘, 색상을 `src/features/shared/constants/streak.ts`(가칭)로 추출하여 출석보드 이펙트와 신규 뱃지가 같은 상수를 쓰게 한다.

---

## 4. 작업 ③ 주사제 정보를 의사 화면에 표시

### 4.1 데이터 가용성 (Carescheduler에서 확인)
- `schedule_executions`(completed 2,181건)에 투여 이력 보관: `executed_date`, `planned_date`, `status`.
- 회차("몇 번째")는 schedule별 completed execution을 `executed_date` 순 정렬한 순번으로 계산 가능(실측 확인: 인베가 트린자 1~4차 등).
- 주사제 필터: 기존 외부 API와 동일하게 `items.category = 'injection'`, 부서 `'낮병원'`.

### 4.2 Carescheduler 신규 엔드포인트 (코드 위치: `/Users/seunghyun/Carescheduler`)

`GET /api/external/injections/history?patient_number=<IDNO>` 신설. 기존 `/api/external/injections/route.ts`의 인증·환자조회 패턴을 그대로 따른다.

**응답 계약**:
```jsonc
{
  "patient_number": "12345",
  "patient_name": "홍길동",
  "injections": [
    {
      "item_name": "인베가 트린자",
      "interval_weeks": 12,
      "next_due_date": "2026-08-20",     // active schedule 기준, 없으면 null
      "total_doses": 4,                   // 누적 완료 회차
      "history": [
        { "dose_seq": 1, "executed_date": "2025-09-18", "planned_date": "2025-09-18" },
        { "dose_seq": 2, "executed_date": "2025-12-11", "planned_date": "2025-12-11" }
        // dose_seq는 오름차순 부여, 응답 배열은 최신순(4.4 UI 정렬과 일치)
      ]
    }
  ]
}
```
- schedule 범위: 이력 완전성을 위해 해당 환자의 injection 카테고리 schedule 전체(상태 무관)를 대상으로 하되, `next_due_date`는 active schedule에서만 채운다.
- 동일 약품(item_name)이 여러 schedule에 걸쳐 있으면 약품명 기준으로 묶고 회차는 전체 누적으로 연속 부여한다.

### 4.3 Daycare 백엔드 (BFF)
- `src/server/integrations/carescheduler/client.ts`에 `fetchInjectionHistoryByPatientNumber(patientNumber)` 추가 (기존 5초 타임아웃/실패 패턴 동일).
- `src/server/integrations/carescheduler/schema.ts`에 이력 응답 zod 스키마 추가.
- `src/features/injections/backend/service.ts`에 `getPatientInjectionHistory(supabase, patientId)` 추가 — patient_id → patient_id_no 매핑 후 호출, `upstream_available` 폴백 유지.
- `src/features/injections/backend/route.ts`에 `GET /patient/:patientId/history` 추가.
- `schema.ts`/`dto.ts`에 BFF 응답 스키마/타입 재노출.

### 4.4 Daycare 프론트 (의사 진료 패널)
- 신규 훅 `usePatientInjectionHistory(patientId)` (React Query, `enabled: !!patientId`, staleTime 10분 — 기존 주사제 훅 패턴 일치).
- 신규 컴포넌트 `src/features/injections/components/PatientInjectionHistoryCard.tsx`:
  - 각 약품: 약품명 · 다음 예정일 D-day 뱃지(기존 `PatientInjectionsCard`의 D-day 헬퍼 재사용) · **"총 N회차"**.
  - 이력 리스트: `N차 · YYYY-MM-DD (요일)` 형식, **최신순** 정렬(가장 최근 맞은 회차가 위). 길면 접기/펼치기.
  - 폴백: 로딩 / upstream 장애 / 데이터 없음 메시지(기존 카드 문구 패턴 재사용).
- 배치 위치: 의사 대시보드 진료 패널 `src/features/doctor/components/ConsultationPanel.tsx` 내, 선택된 환자 영역에 카드로 삽입.

### 4.5 범위 밖 (이번 작업 아님)
- 의사 외 역할의 주사제 이력 카드 추가(현재는 의사 진료 패널만).
- Carescheduler 측 UI 변경.

---

## 5. 컴포넌트/모듈 경계 요약

| 모듈 | 책임 | 의존 |
|---|---|---|
| `shared/backend/streak.ts` | 스트릭 계산 + 자동 closure 감지(순수+로더) | supabase 데이터 |
| `shared/constants/streak.ts` | tier 임계값·아이콘·색상 단일 출처 | 없음 |
| `shared/components/StreakBadge.tsx` | 목록용 압축 스트릭 뱃지 | 상수 |
| `GET /api/shared/streaks` | 전 환자 스트릭 맵 | streak.ts |
| `useStreaks(date)` | 프론트 스트릭 맵 훅 | api-client |
| Carescheduler `injections/history` | 환자별 주사 이력+회차 | schedule_executions |
| `injections` BFF (history) | Carescheduler 이력 중계 | client/schema |
| `PatientInjectionHistoryCard` | 의사 진료 패널 이력 표시 | usePatientInjectionHistory |

---

## 6. 마이그레이션
- `supabase/migrations/XXXX_seed_holidays_2026.sql` — 2026년 한국 공휴일 + 확인된 휴원일(06-03, 05-25, 05-05, 05-01 등) 멱등 insert (`ON CONFLICT (date) DO NOTHING`). 사용자가 Supabase에 적용.

---

## 7. 검증 기준
- 매일 출석하는 환자(예: 이상재)의 출석보드 스트릭이 06-03을 건너뛰어 두 자릿수로 이어진다.
- 4개 역할 대시보드 환자 목록에서 streak ≥ 3 환자에 등급 뱃지가 보인다.
- 의사 진료 패널에서 선택 환자의 주사 이력(회차+날짜)과 다음 예정일이 보인다.
- TypeScript/ESLint/빌드 오류 없음.

---

## 8. 결정된 사항 (사용자 확인)
- 스트릭 수정: 자동 감지 + 공휴일 등록 병행.
- 스트릭 표시: 환자 목록 카드 뱃지(4개 역할).
- 주사제: Carescheduler에 이력 엔드포인트 추가.
- 주사제 위치: 의사 진료 패널(선택 환자).
- Carescheduler 코드: `/Users/seunghyun/Carescheduler`에서 직접 구현.

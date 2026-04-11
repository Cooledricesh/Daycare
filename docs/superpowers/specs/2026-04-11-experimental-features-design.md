# 실험적 기능 4종 설계 (히트맵 / 하이라이트 카드 / 타임라인 / 생일)

## 개요

낮병원 앱에 실험적 성격의 부가 기능 4종을 추가한다. 핵심 원칙은 **"기존에 잘 동작하는 기능을 절대 망가뜨리거나 초기 로딩 속도를 떨어뜨리지 않는다"** 이다.

### 핵심 원칙

- **제로 리스크 우선** — 모든 신규 섹션은 독립적으로 추가되며, 데이터가 없거나 접힘 상태일 때 기존 페이지 perf/UI에 영향 0
- **기존 API/서비스 최대 재사용** — 신규 엔드포인트를 만들기 전에 기존 hook/service 재사용 가능성부터 검토
- **Lazy loading 기본** — 기본 로딩은 최소 범위만, 사용자가 명시적으로 확장 버튼을 눌렀을 때만 추가 데이터 패치
- **React Query staleTime 충분히 길게** — 하이라이트/타임라인은 10분 이상 캐시해서 재요청 빈도 낮춤
- **데이터 없으면 안 보임** — `birth_date IS NULL` 환자는 생일 UI 표시 0, 신규 섹션은 collapse 가능

### 기능 목록

| # | 기능 | 위치 | 기본 범위 |
|---|------|------|-----------|
| 1 | 출석 히트맵 | 환자 상세 페이지(nurse/staff) | 최근 3개월 (lazy로 12개월까지 확장) |
| 2 | 오늘의 하이라이트 카드 | 모든 역할 대시보드(admin/staff/nurse/doctor) | 당일 5종 이벤트 |
| 3 | 환자 타임라인(가로 요약) | 환자 상세 페이지 | 7종 이벤트 아이콘, ConsultationHistory 스크롤 연동 |
| 4 | 환자 생일 | patients 테이블 + 카드/캘린더/프로필 | `birth_date IS NULL`이면 표시 없음 |

---

## 1. 출석 히트맵

### 목적

한 환자의 출석 패턴을 GitHub 잔디 스타일로 시각화하여, 규칙성이나 이탈 시점을 한눈에 파악할 수 있게 한다.

### 위치

- `/nurse/patient/[id]` — 환자 상세 페이지 내 신규 섹션 "출석 히트맵"
- `/staff/patient/[id]` — 동일

기본 접힌 상태가 아니라 **펼쳐진 상태로** 노출 (사용자가 바로 볼 수 있도록). 단, 데이터 로딩은 페이지 initial load를 블로킹하지 않도록 섹션 단위 스켈레톤을 사용.

### 데이터

- **기존 hook 재사용**: `usePatientAttendanceCalendar(patientId, year, month)`
- 기본 3개월: `useQueries`로 3개월치 병렬 요청 (현재 달, 1달 전, 2달 전)
- "1년 전체 보기" 버튼 클릭 시: 나머지 9개월을 추가로 lazy fetch (이 때도 `useQueries`로 병렬)

### UI

- 가로 방향으로 주(week) 열 × 요일 행의 그리드
- 셀 크기: `w-3 h-3` (Tailwind)
- 색상 스케일:
  - 출석 + 진찰 완료: `bg-emerald-500`
  - 출석만 완료: `bg-emerald-200`
  - 예정일인데 결석: `bg-red-300`
  - 비예정일(주말/공휴일): `bg-gray-100`
- 월/주 라벨은 GitHub contribution 그래프 참고
- 호버 시 툴팁: `{날짜} — 출석/결석 상태, 진찰 여부`
- 상단 범례(legend) 표시
- 우측 상단에 "3개월 ↔ 12개월 보기" 토글 버튼

### 성능 고려사항

- 월별 쿼리 병렬화 → 네트워크 라운드트립 동일 (단일 쿼리와 같은 시간)
- React Query 캐시는 기존 `usePatientAttendanceCalendar`의 5분 staleTime 유지
- 9개월 추가 확장은 사용자가 명시적으로 누를 때만 실행

---

## 2. 오늘의 하이라이트 카드

### 목적

의료진이 아침에 대시보드를 열었을 때 "오늘 먼저 봐야 할 환자"를 자동으로 부각시켜 인지 부담을 줄인다.

### 위치

| 역할 | 배치 위치 |
|------|-----------|
| Admin | `/admin/dashboard` 최상단 |
| Staff | `/staff/dashboard` 최상단 |
| Nurse | `/nurse/tasks` 최상단 (간호사 대시보드 대용) |
| Doctor | `/doctor/history` 최상단 |

컴포넌트는 `src/features/highlights/components/TodayHighlightCard.tsx` 단일 파일에서 관리. 각 역할별 페이지는 이 컴포넌트만 import.

### 감지 이벤트 5종

| # | 이벤트 | 조건 | 데이터 소스 |
|---|--------|------|-------------|
| 1 | 3일 연속 결석 | 최근 3일간 scheduled 있었으나 attended 없음 | `absence-risk` 서비스 재사용 |
| 2 | 개근자 갑작스런 결석 | 최근 14일 출석률 >=90%였는데 오늘 결석 | `absence-risk` 서비스 확장 |
| 3 | 진찰 누락 | 오늘 출석했는데 consultation 없음 | `attendances` + `consultations` join |
| 4 | 오늘 생일 | `birth_date`의 월/일이 오늘과 일치 | `patients.birth_date` |
| 5 | 신규 등록 | 오늘 `created_at` | `patients.created_at` |

### 백엔드

- **신규 엔드포인트**: `GET /api/shared/highlights/today`
- **파일**: `src/features/highlights/backend/{route,service,schema,error}.ts`
- **응답 스키마**:
  ```ts
  {
    date: string; // YYYY-MM-DD
    events: {
      threeDayAbsence: HighlightPatient[];   // 최대 10명
      suddenAbsence: HighlightPatient[];     // 최대 10명
      examMissed: HighlightPatient[];        // 최대 10명
      birthdays: HighlightPatient[];
      newlyRegistered: HighlightPatient[];
    };
  }

  type HighlightPatient = {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    roomNumber: string | null;
    meta?: string; // 이벤트별 추가 정보 (예: "3일 연속")
  }
  ```
- 내부적으로 `absence-risk` 서비스의 `buildPatientAttendanceMap`을 재사용
- 전체 환자 루프는 최근 14일치만 조회 (이미 absence-risk가 하는 방식)

### 프론트엔드

- **Hook**: `useTodayHighlights()` — React Query, staleTime **10분**, refetchOnWindowFocus **false**
- **컴포넌트**: `TodayHighlightCard`
  - 5종 이벤트를 가로로 나열된 칩/카드로 표시
  - 이벤트 종류별 색상: amber(3일 연속 결석), red(갑작스런 결석), blue(진찰 누락), pink(생일), green(신규)
  - 각 환자 칩 클릭 → 해당 역할의 환자 상세 페이지로 이동
  - 이벤트가 모두 0건이면 "오늘은 특이사항이 없습니다" 빈 상태 표시
- **스켈레톤**: 로딩 중에도 카드의 프레임(제목+높이)은 유지해서 layout shift 방지

### 성능 고려사항

- 단일 엔드포인트로 5종을 한 번에 반환 → 역할별 대시보드당 1회 쿼리만 추가
- `staleTime: 10분` → 30분 근무시간 동안 최대 3회 재조회
- `absence-risk`는 이미 비슷한 계산을 하고 있으므로 Supabase 쿼리 양은 기존 수준

---

## 3. 환자 타임라인 (가로 요약)

### 목적

한 환자의 입원부터 오늘까지 주요 이벤트를 가로축 한 줄로 훑어볼 수 있게 한다. 세부 내용은 기존 `ConsultationHistory`(세로형)로 점프.

### 위치

`/nurse/patient/[id]`, `/staff/patient/[id]`, `/doctor/history/[id]` 환자 상세 페이지의 `ConsultationHistory` 바로 위. 기존 ConsultationHistory는 **일절 수정하지 않음** (위험 0).

### 이벤트 타입 7종

| # | 이벤트 | 아이콘 | 색상 |
|---|--------|--------|------|
| 1 | 출석 체크 | `Check` | emerald |
| 2 | 진찰 체크 | `Stethoscope` | blue |
| 3 | 의사 메시지/메모 | `MessageSquare` | slate |
| 4 | 결석 | `X` | red |
| 5 | 입원(`created_at`) | `LogIn` | green |
| 6 | 퇴원 | `LogOut` | gray |
| 7 | 생일 | `Cake` | pink |

### 백엔드

- **신규 엔드포인트**: `GET /api/shared/patient/:id/timeline`
- **파일**: `src/features/patient-timeline/backend/{route,service,schema,error}.ts`
- **응답**:
  ```ts
  {
    patientId: string;
    range: { startDate: string; endDate: string }; // 입원일 ~ 오늘
    events: Array<{
      date: string;          // YYYY-MM-DD
      type: 'attendance' | 'consultation' | 'message' | 'absence' | 'admission' | 'discharge' | 'birthday';
      label: string;         // 간단 설명
    }>;
  }
  ```
- 입원일: `patients.created_at`
- 퇴원일: 별도 `discharged_at` 컬럼이 없으므로, `patients.status = 'discharged'`일 때 `updated_at`을 approximate discharge date로 사용 (구현 플랜에서 정확한 소스 재확인 필요 — 만약 부정확하면 discharge 이벤트는 생략하고 현재 상태만 우측 끝에 표시)
- 생일: 입원~오늘 사이에 해당하는 모든 생일 날짜 (`birth_date` 기반 연 단위 생성)
- 결석: scheduled 있고 attended 없는 날
- React Query staleTime **10분**

### 프론트엔드

- **컴포넌트**: `PatientTimelineStrip`
  - 가로 스크롤 가능한 `div`
  - 입원일부터 오늘까지 일자별 컬럼 (일자는 x축, 이벤트는 세로로 쌓이는 작은 아이콘)
  - 이벤트 셀 클릭 → 동일 페이지 내 `ConsultationHistory`에서 같은 날짜로 `scrollIntoView`
  - 해당 날짜로 이동할 때 `ConsultationHistory` 쪽 아이템에 1~2초간 highlight ring 표시
- **스크롤 연동**: `useRef` 맵을 ConsultationHistory에 추가해야 함 (최소 변경, 기존 로직 유지)
  - **예외적 기존 컴포넌트 수정**: `ConsultationHistory`에 `data-date="{YYYY-MM-DD}"` 속성만 추가. 시각/동작 영향 0.

### 성능 고려사항

- 신규 엔드포인트 1회 추가 (환자 상세 페이지당)
- 병렬 쿼리 5건(출석/결석/진찰/메시지/환자메타) → Promise.all
- 데이터 양은 환자 한 명 기준 수백 건 수준이므로 부담 적음

---

## 4. 환자 생일

### 데이터베이스

```sql
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN patients.birth_date IS '환자 생년월일 (nullable, 수동 입력)';
```

- **nullable** — 기존 환자는 NULL, 신규 환자는 등록 폼에서 선택적 입력
- 인덱스는 추가하지 않음 (범위 쿼리 대부분이 `EXTRACT(month, day)` 기반이고, 환자 수가 수만 건 단위는 아님)

### 입력 경로

1. **환자 등록 폼** (`src/features/admin/components/PatientRegisterForm.tsx` 등)에 `생년월일` 필드 추가 (shadcn `DatePicker` 또는 `<Input type="date">`)
2. **환자 상세 페이지**의 프로필 섹션에 "생일 편집" 인라인 버튼 — 기존 환자 1명씩 수동 입력
3. **PUT /api/admin/patients/:id** 같은 기존 수정 엔드포인트에 `birth_date` 필드 허용

### 표시 위치

| # | 위치 | 표시 방식 |
|---|------|-----------|
| 1 | 환자 카드 3종 (Nurse/Staff/Doctor history) | `🎂 3/15` 작은 텍스트, `birth_date IS NULL`이면 아예 렌더링 안 함 |
| 2 | 환자 카드 — 오늘이 생일이면 | amber 배지 "오늘 생일 🎉" |
| 3 | `AttendanceCalendar` | 생일 당일 셀 우측 상단에 `Cake` 아이콘 작게 overlay |
| 4 | 하이라이트 카드 | 이미 2.의 이벤트 #4로 처리됨 |
| 5 | 환자 상세 페이지 프로필 | "1974-03-15 (만 52세)" 표시. `formatBirthDate()` + `calculateKoreanAge()` 유틸 추가 |

### 유틸리티

- `src/lib/birthday.ts` 신규
  - `formatBirthDate(date: string): string` — "3/15" 또는 "1974-03-15"
  - `calculateKoreanAge(birthDate: string, today?: Date): number` — 만 나이
  - `isBirthdayToday(birthDate: string | null, today?: Date): boolean`
  - `upcomingBirthday(birthDate: string, today?: Date): number` — 며칠 후

### 성능 고려사항

- 생일 표시는 순수 클라이언트 측 포맷팅 → 쿼리 증가 없음
- 카드 컴포넌트에서 렌더링 분기 (`birth_date` 필드만 select 절에 추가)
- 기존 `patients` select가 `*`가 아닌 명시 컬럼일 경우, `birth_date` 컬럼을 추가해야 함 → 탐색 단계에서 점검 필요 항목

---

## 5. 마이그레이션

**파일**: `supabase/migrations/20260411000001_add_patient_birth_date.sql`

```sql
-- Migration: patients.birth_date 컬럼 재추가
-- birth_date는 20241202 마이그레이션에서 DROP 되었으나,
-- 생일 알림/표시 기능을 위해 재도입한다.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN patients.birth_date IS '환자 생년월일 (nullable, 수동 입력, 생일 알림/표시용)';
```

- idempotent(`IF NOT EXISTS`)
- RLS 없음(프로젝트 규칙)
- 별도 인덱스 없음

---

## 6. 영향받는 파일 맵

### 신규 파일

```
src/features/highlights/
├── backend/
│   ├── route.ts
│   ├── service.ts
│   ├── schema.ts
│   └── error.ts
├── hooks/
│   └── useTodayHighlights.ts
├── components/
│   └── TodayHighlightCard.tsx
└── lib/
    └── dto.ts

src/features/patient-timeline/
├── backend/
│   ├── route.ts
│   ├── service.ts
│   ├── schema.ts
│   └── error.ts
├── hooks/
│   └── usePatientTimeline.ts
├── components/
│   └── PatientTimelineStrip.tsx
└── lib/
    └── dto.ts

src/features/shared/components/
└── AttendanceHeatmap.tsx           # 히트맵 (기존 AttendanceCalendar hook 재사용)

src/lib/birthday.ts                  # 생일 관련 유틸

supabase/migrations/
└── 20260411000001_add_patient_birth_date.sql
```

### 기존 파일 수정 (최소 범위)

| 파일 | 변경 내용 |
|------|-----------|
| `src/backend/hono/app.ts` | `registerHighlightsRoutes`, `registerPatientTimelineRoutes` 등록 |
| `src/features/nurse/backend/service.ts` | 환자 select에 `birth_date` 추가 |
| `src/features/staff/backend/service.ts` | 환자 select에 `birth_date` 추가 |
| `src/features/doctor/backend/service.ts` | 환자 select에 `birth_date` 추가 |
| `src/features/admin/backend/service.ts` | 환자 select에 `birth_date` 추가, 등록/수정 API에 필드 추가 |
| `src/features/nurse/components/NursePatientCard.tsx` | 생일 표시 로직 추가 |
| `src/features/staff/components/PatientCard.tsx` | 생일 표시 로직 추가 |
| `src/features/doctor/components/PatientHistoryCard.tsx` | 생일 표시 로직 추가 |
| `src/features/shared/components/AttendanceCalendar.tsx` | 생일 셀 오버레이 추가 (조건부) |
| `src/features/doctor/components/ConsultationHistory.tsx` | `data-date` 속성 추가 (스크롤 연동용, 시각 영향 0) |
| 각 역할 대시보드 페이지 | `<TodayHighlightCard />` import 후 상단 배치 |
| 환자 상세 페이지 3종 | `<AttendanceHeatmap />` + `<PatientTimelineStrip />` 섹션 추가 |
| 환자 등록/편집 폼 | 생년월일 DatePicker 필드 추가 |

---

## 7. 에러 처리 & 테스트 전략

### 에러 처리

- 모든 신규 엔드포인트는 `respond()/failure()/success()` 패턴 사용
- `birth_date` 파싱 실패 시 zod로 걸러서 "잘못된 날짜 형식" 반환
- 히트맵의 다월 병렬 요청 중 일부가 실패해도 나머지 월은 렌더링 (isolate errors)
- 하이라이트 카드는 5종 이벤트 중 일부가 실패해도 성공한 카테고리는 표시 ("partial success" 패턴 — 서비스 내부에서 try/catch)

### 테스트

- `src/lib/birthday.ts` 유닛 테스트: `calculateKoreanAge`, `isBirthdayToday`, `formatBirthDate` — 연말/연초 경계, 윤년(2/29) 생일
- `src/features/highlights/backend/service.ts` 유닛 테스트: mock supabase client로 5종 이벤트 각각 생성 시나리오
- `src/features/patient-timeline/backend/service.ts` 유닛 테스트: 이벤트 병합 로직
- 기존 `AttendanceCalendar` 스냅샷/동작 테스트 — 생일 오버레이 조건부 렌더링이 기존 케이스를 깨지 않는지 확인
- E2E는 생략 (실험적 기능 + 기존 UI 퇴행 방지는 유닛/컴포넌트 테스트로 충분)

---

## 8. 구현 순서 (예비)

1. **마이그레이션** — `birth_date` 컬럼 재추가 (사용자가 수동 적용)
2. **생일 유틸 + 타입** — `src/lib/birthday.ts` + 각 service select 확장
3. **환자 카드 3종 표시 + 등록/편집 폼** — 생일 입력/표시 가능
4. **AttendanceCalendar 생일 오버레이** — 조건부 렌더링
5. **AttendanceHeatmap 컴포넌트** — 기본 3개월, lazy 12개월
6. **환자 상세 페이지 히트맵 섹션 통합**
7. **TodayHighlightCard backend + hook + component**
8. **각 역할 대시보드에 하이라이트 카드 통합**
9. **PatientTimelineStrip backend + hook + component**
10. **ConsultationHistory `data-date` 추가 + 스크롤 연동**
11. **유닛 테스트 작성**
12. **수동 QA: 역할별 로그인 → 대시보드/환자 상세 페이지 퇴행 없는지 확인**

구현 세부는 `writing-plans` 스킬로 작성되는 플랜 문서에서 추가 정의된다.

---

## 9. 향후 개선 아이디어 (본 설계 scope 외)

- 히트맵 전체 환자 비교 뷰 (어드민 전용)
- 하이라이트 카드 이벤트 dismiss/읽음 처리
- 타임라인 이벤트 커스텀 필터 (종류별 토글)
- 생일 알림 이메일/카카오톡 연동
- 만 나이 외에 세는 나이 옵션

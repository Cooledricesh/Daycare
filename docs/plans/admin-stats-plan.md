# Admin Stats Page Implementation Plan

## Overview

- **페이지 목적**: 출석률, 진찰 참석률 통계 및 일별 추이 조회
- **PRD 참조**: [Section 7.6 관리자 화면 - 통계 대시보드](../prd.md#통계-대시보드)
- **URL**: `/admin/stats`

## Component Hierarchy

```
AdminStatsPage
├── AdminLayout
│   ├── AdminHeader
│   └── AdminSidebar
└── StatsDashboardSection
    ├── StatsPageHeader
    │   ├── PageTitle
    │   └── DateRangePicker
    │       ├── StartDatePicker
    │       ├── EndDatePicker
    │       └── ApplyButton
    ├── SummaryCards
    │   ├── AverageAttendanceRateCard
    │   │   ├── CardTitle
    │   │   ├── RateValue
    │   │   └── RateChange (전월 대비)
    │   ├── AverageConsultationRateCard
    │   │   ├── CardTitle
    │   │   ├── RateValue
    │   │   └── RateChange
    │   └── TodayAttendanceCard
    │       ├── CardTitle
    │       ├── AttendanceCount
    │       └── ScheduledCount
    ├── AttendanceRateTrendChart
    │   ├── ChartTitle
    │   ├── ChartLegend
    │   └── LineChart
    │       ├── AttendanceRateLine (출석률)
    │       └── ConsultationRateLine (진찰 참석률)
    └── DetailedStatsTable
        ├── TableHeader
        └── TableBody
            └── StatsRow[]
                ├── DateCell
                ├── ScheduledCountCell
                ├── AttendanceCountCell
                ├── ConsultationCountCell
                ├── AttendanceRateCell
                └── ConsultationRateCell
```

## Features by Priority

### P0 (Must Have)

- [ ] 기간 선택 (기본: 최근 30일)
- [ ] 요약 카드 3개
  - [ ] 평균 출석률 (%)
  - [ ] 평균 진찰 참석률 (%)
  - [ ] 오늘 출석 현황 (N/M명)
- [ ] 일별 출석률 추이 차트 (선 그래프)
  - [ ] 출석률 라인
  - [ ] 진찰 참석률 라인
- [ ] 상세 통계 테이블
  - [ ] 날짜, 예정 인원, 출석 수, 진찰 수, 출석률, 진찰 참석률

### P1 (Should Have)

- [ ] 전월 대비 증감률 표시 (△ +5.2%, ▽ -3.1%)
- [ ] 차트 데이터 포인트 hover 시 상세 정보
- [ ] 주간/월간 집계 모드
- [ ] 통계 엑셀 다운로드
- [ ] 차트 이미지 다운로드 (PNG)

### P2 (Nice to Have)

- [ ] 요일별 평균 출석률 (월요일 평균, 화요일 평균 등)
- [ ] 담당 코디별 출석률 비교
- [ ] 환자별 출석률 순위 (상위/하위 10명)
- [ ] 결석 사유 통계 (향후 사유 필드 추가 시)

## Data Requirements

### API Endpoints

#### GET /api/admin/stats/summary
- **Query Parameters**:
  - `start_date`: YYYY-MM-DD
  - `end_date`: YYYY-MM-DD
- **Response**:
  ```typescript
  {
    period: {
      start: string;
      end: string;
    };
    average_attendance_rate: number; // %
    average_consultation_rate: number; // %
    total_scheduled: number;
    total_attendance: number;
    total_consultation: number;
    today: {
      scheduled: number;
      attendance: number;
      consultation: number;
    };
    previous_period: {
      average_attendance_rate: number;
      average_consultation_rate: number;
    };
  }
  ```

#### GET /api/admin/stats/daily
- **Query Parameters**:
  - `start_date`: YYYY-MM-DD
  - `end_date`: YYYY-MM-DD
- **Response**:
  ```typescript
  {
    data: DailyStats[];
  }
  ```

#### GET /api/admin/stats/today
- **Response**:
  ```typescript
  {
    date: string;
    scheduled: number;
    attendance: number;
    consultation: number;
    attendance_rate: number;
    consultation_rate: number;
  }
  ```

### State Management

#### Server State (React Query)
- `useStatsSummary`: 요약 통계 조회
- `useDailyStats`: 일별 통계 조회
- `useTodayStats`: 오늘 통계 조회

#### Client State (Zustand)
- `adminStatsStore`:
  - `dateRange`: { start: string, end: string }
  - `chartMode`: 'daily' | 'weekly' | 'monthly'

## Dependencies

### 필요한 컴포넌트
- `shadcn/ui`:
  - `Card`
  - `Table`
  - `Calendar` (DateRangePicker)
  - `Button`
  - `Select`

### 외부 라이브러리
- `@tanstack/react-query`: 서버 상태 관리
- `zustand`: 클라이언트 상태 관리
- `recharts`: 차트 라이브러리
- `date-fns`: 날짜 포맷팅, 계산
- `lucide-react`: 아이콘

## Implementation Steps

1. **레이아웃 구성**
   - AdminLayout 재사용
   - 페이지 헤더: "통계" + 날짜 범위 선택

2. **날짜 범위 선택**
   - DateRangePicker (시작일/종료일)
   - 기본값: 오늘 - 30일 ~ 오늘
   - "적용" 버튼 클릭 시 데이터 갱신

3. **요약 카드**
   - Card 컴포넌트 3개
   - 큰 숫자 표시 (평균 출석률 87.3%)
   - 전월 대비 증감률 (△ +5.2%, 초록/빨강 색상)

4. **일별 추이 차트**
   - recharts LineChart 사용
   - X축: 날짜 (MM/DD 형식)
   - Y축: 출석률 (0-100%)
   - 2개 라인: 출석률(파랑), 진찰 참석률(초록)
   - 툴팁: hover 시 상세 정보

5. **상세 통계 테이블**
   - shadcn Table 사용
   - 날짜별 행
   - 컬럼: 날짜, 예정, 출석, 진찰, 출석률, 진찰 참석률

6. **API 연동**
   - Hono 백엔드 라우터 구현
   - daily_stats 테이블 조회
   - 집계 로직 구현 (평균 계산)

7. **상태 관리**
   - Zustand 스토어: 날짜 범위 관리
   - React Query: 서버 데이터 캐싱

## Chart Configuration

### LineChart (recharts)

```typescript
<ResponsiveContainer width="100%" height={400}>
  <LineChart data={dailyStats}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" tickFormatter={formatDate} />
    <YAxis domain={[0, 100]} />
    <Tooltip content={<CustomTooltip />} />
    <Legend />
    <Line
      type="monotone"
      dataKey="attendance_rate"
      stroke="#2563EB"
      name="출석률"
      strokeWidth={2}
    />
    <Line
      type="monotone"
      dataKey="consultation_rate"
      stroke="#16A34A"
      name="진찰 참석률"
      strokeWidth={2}
    />
  </LineChart>
</ResponsiveContainer>
```

## Business Logic

### 평균 계산

```sql
SELECT
  AVG(attendance_rate) AS average_attendance_rate,
  AVG(consultation_rate) AS average_consultation_rate,
  SUM(scheduled_count) AS total_scheduled,
  SUM(attendance_count) AS total_attendance,
  SUM(consultation_count) AS total_consultation
FROM daily_stats
WHERE date BETWEEN :start_date AND :end_date;
```

### 전월 대비 증감률 계산

```typescript
const change = ((current - previous) / previous) * 100;
const changeText = change >= 0 ? `△ +${change.toFixed(1)}%` : `▽ ${change.toFixed(1)}%`;
const changeColor = change >= 0 ? 'text-green-600' : 'text-red-600';
```

### 오늘 통계 실시간 계산

```sql
SELECT
  CURRENT_DATE AS date,
  (SELECT COUNT(*) FROM scheduled_attendances WHERE date = CURRENT_DATE AND is_cancelled = false) AS scheduled,
  (SELECT COUNT(*) FROM attendances WHERE date = CURRENT_DATE) AS attendance,
  (SELECT COUNT(*) FROM consultations WHERE date = CURRENT_DATE) AS consultation;
```

## Security Considerations

- **권한 확인**: 관리자 역할만 접근 가능
- **날짜 범위 제한**: 최대 1년 (성능 고려)
- **SQL Injection 방지**: Parameterized queries

## Performance Considerations

- **인덱스 활용**: idx_daily_stats_date
- **날짜 범위 제한**: 최대 1년 (365일)
- **React Query Cache**: staleTime 10분
- **차트 데이터 최적화**: 일별 집계 데이터 사용 (실시간 집계 X)

## Accessibility

- **차트 대체 텍스트**: 스크린 리더를 위한 데이터 테이블 제공
- **색상 접근성**: 출석률/진찰 참석률 라인 구분 (색상 외 패턴도 적용)
- **키보드 네비게이션**: 날짜 선택 키보드 지원

## Error Handling

- **데이터 없음**: "해당 기간 통계가 없습니다" 메시지
- **API 오류**: "통계를 불러오는 중 오류가 발생했습니다" 재시도 버튼
- **잘못된 날짜 범위**: "시작일이 종료일보다 늦을 수 없습니다" 유효성 검사

---

*문서 버전: 1.0*
*작성일: 2025-01-29*

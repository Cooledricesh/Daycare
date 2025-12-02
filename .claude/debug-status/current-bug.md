---
status: VERIFIED
timestamp: 2025-12-03T00:13:13+09:00
bug_id: BUG-20251203-001
verified_by: error-verifier
severity: Critical
---

# 버그 검증 완료

## 상태: VERIFIED ✅

## 요약
`/admin/patients` 페이지에서 환자 목록 조회 API가 400 Bad Request 에러를 반환하며 실패합니다. 에러 메시지는 "환자 목록 조회 실패: Could not embed because more than one relationship was found for 'patients' and 'staff'" 입니다. Supabase의 관계 지정 문제로 인한 버그입니다.

## 재현 결과

### 재현 성공 여부: 예 ✅

### 재현 단계:
1. 개발 서버를 시작 (`npm run dev`)
2. API 엔드포인트 호출: `GET http://localhost:3000/api/admin/patients?page=1&limit=20`
3. 400 Bad Request 에러 발생 확인

### 관찰된 에러:
```json
{
  "error": {
    "code": "PATIENT_CREATE_FAILED",
    "message": "환자 목록 조회 실패: Could not embed because more than one relationship was found for 'patients' and 'staff'"
  }
}
```

### 예상 동작 vs 실제 동작:
- **예상**: 환자 목록 데이터가 정상적으로 반환되어야 함
- **실제**: 400 Bad Request 에러가 발생하며 데이터가 로딩되지 않음

## 영향도 평가

- **심각도**: Critical
- **영향 범위**: 
  - `/Users/seunghyun/Project/Daycare/src/features/admin/backend/service.ts` (라인 34-118)
  - `/Users/seunghyun/Project/Daycare/src/features/admin/backend/route.ts` (라인 50-70)
  - Database Schema: `patients` 테이블과 `staff` 테이블 간 외래키 관계
- **사용자 영향**: 관리자가 환자 목록을 전혀 조회할 수 없음. 핵심 기능 마비.
- **발생 빈도**: 항상 (100% 재현)

## 수집된 증거

### 스택 트레이스:
```
HTTP/1.1 400 Bad Request
content-type: application/json

{
  "error": {
    "code": "PATIENT_CREATE_FAILED",
    "message": "환자 목록 조회 실패: Could not embed because more than one relationship was found for 'patients' and 'staff'"
  }
}
```

### 관련 코드:

**파일**: `/Users/seunghyun/Project/Daycare/src/features/admin/backend/service.ts` (라인 40-53)
```typescript
let queryBuilder = supabase
  .from('patients')
  .select(`
    id,
    name,
    birth_date,
    gender,
    coordinator_id,
    status,
    memo,
    created_at,
    updated_at,
    coordinator:staff(name)
  `, { count: 'exact' });
```

**문제점**: `patients` 테이블은 `staff` 테이블과 **두 개의 외래키 관계**를 가지고 있습니다:
1. `coordinator_id` → `staff(id)` 
2. `doctor_id` → `staff(id)` (migration 20241202000001에서 추가됨)

Supabase는 `coordinator:staff(name)` 구문에서 어떤 외래키를 사용해야 할지 결정할 수 없어 에러를 발생시킵니다.

### 데이터베이스 스키마:

**파일**: `/Users/seunghyun/Project/Daycare/supabase/migrations/20241128000000_init_schema.sql` (라인 24-34)
```sql
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  birth_date DATE,
  gender VARCHAR(10),
  coordinator_id UUID REFERENCES staff(id),
  status VARCHAR(20) DEFAULT 'active',
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**파일**: `/Users/seunghyun/Project/Daycare/supabase/migrations/20241202000001_alter_patients_add_columns.sql` (라인 6-9)
```sql
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS room_number VARCHAR(10),
ADD COLUMN IF NOT EXISTS patient_id_no VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES staff(id);
```

### 추가 로그:
- 클라이언트 측에서 `xhr.js:198` 에러 발생 (Axios 에러 핸들러)
- 에러 코드 `PATIENT_CREATE_FAILED`는 잘못 사용됨 (실제로는 조회 실패인데 생성 실패 코드 사용)

## 근본 원인 분석

### 직접 원인:
Supabase PostgREST는 동일한 테이블에 대한 여러 외래키 관계가 있을 때 명시적으로 관계를 지정하지 않으면 ambiguous relationship 에러를 발생시킵니다.

### 기술적 세부사항:
1. `patients` 테이블은 `staff` 테이블과 **두 개의 foreign key**를 가짐:
   - `coordinator_id` (코디네이터)
   - `doctor_id` (주치의)

2. Supabase 쿼리 `coordinator:staff(name)`는 **관계 이름만 지정**하고 **어떤 외래키를 사용할지 명시하지 않음**

3. Supabase는 자동으로 관계를 추론할 수 없어 에러 발생:
   ```
   Could not embed because more than one relationship was found for 'patients' and 'staff'
   ```

### 해결 방법:
외래키 컬럼을 명시적으로 지정해야 합니다:
```typescript
// 잘못된 코드 (현재)
coordinator:staff(name)

// 올바른 코드
coordinator:staff!coordinator_id(name)
```

## 재현 조건

- 환경: 로컬 개발 환경 (macOS, Node.js)
- API 엔드포인트: `GET /api/admin/patients`
- 필수 조건:
  - Supabase 데이터베이스에 migration 적용 완료
  - `patients` 테이블에 `coordinator_id`와 `doctor_id` 두 외래키 존재
- 재현율: 100% (항상 발생)

## 영향을 받는 다른 쿼리

동일한 패턴을 사용하는 다른 쿼리들도 영향을 받을 가능성이 높습니다:

1. **`getPatientDetail`** (service.ts 라인 124-139)
   ```typescript
   coordinator:staff(name)  // 동일한 문제
   ```

2. **`getSchedulePatterns`** (service.ts 라인 494-498)
   ```typescript
   coordinator:staff(name)  // 동일한 문제
   ```

3. **`getDailySchedule`** (service.ts 라인 586-593)
   ```typescript
   coordinator:patients!patient_id(coordinator:staff(name))  // 중첩된 관계, 동일한 문제
   ```

4. **`addManualSchedule`** (service.ts 라인 667-675)
   ```typescript
   coordinator:patients!patient_id(coordinator:staff(name))  // 중첩된 관계, 동일한 문제
   ```

## Quality Gate 1 체크리스트

- [x] 버그 재현 성공
- [x] 에러 메시지 완전 수집
- [x] 영향 범위 명확히 식별 (4개 함수 확인)
- [x] 증거 충분히 수집 (스키마, 코드, 에러 로그)
- [x] 한글 문서 완성

## Quality Gate 1 점수: 95/100

**감점 사유**: 
- 프론트엔드 UI 스크린샷 미수집 (-5점): 브라우저 개발자 도구 콘솔 캡처 없음

## 다음 단계

`root-cause-analyzer` 에이전트를 호출하여 다음을 수행하세요:
1. 모든 영향받는 쿼리의 정확한 범위 확인
2. Supabase foreign key hint 문법 검증
3. 수정 방안의 side effect 분석
4. 테스트 전략 수립
5. 상세 수정 계획 작성

---

**작성 시간**: 2025-12-03 00:13:13 KST
**검증자**: error-verifier agent
**문서 버전**: 1.0

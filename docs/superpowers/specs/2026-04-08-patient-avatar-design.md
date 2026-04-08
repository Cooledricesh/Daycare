# 환자 프로필 사진 기능 설계

## 개요

환자(회원)의 프로필 사진을 등록하여 이름만으로 식별이 어려운 경우 사진으로 누구인지 파악할 수 있게 한다.

### 핵심 원칙

- **로딩 속도 최우선** — 사진 추가로 인해 기존 페이지 로딩이 느려지면 안 됨
- **단순한 구조 유지** — 공통 로직 최대 활용, 최소한의 코드 추가
- **업로드 UI는 편의성보다 단순성** — 한 번 올리면 거의 변경하지 않는 기능

### 적용 범위

| 페이지 | 경로 | 사진 표시 |
|--------|------|----------|
| 의사 진찰 | `/doctor/consultation` | O |
| 코디네이터 대시보드 | `/staff/dashboard` | O |
| 관리자 대시보드 | `/admin/dashboard` | O |
| 간호사 처방 | `/nurse/prescriptions` | O |
| 출석 보드 | `/shared/attendance-board` | X (PixelAvatar 유지) |

### 업로드 권한

- 관리자(admin), 간호사, 코디네이터 등 스태프 — 모두 업로드/삭제 가능
- 환자 본인은 업로드 불가

---

## 1. 데이터베이스

### patients 테이블 변경

```sql
ALTER TABLE patients ADD COLUMN avatar_url TEXT DEFAULT NULL;
```

- `avatar_url`: Supabase Storage Public URL 문자열
- nullable — 사진 미등록 시 NULL

### Supabase Storage 버킷

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-avatars', 'patient-avatars', true);
```

- **Public 버킷** — CDN URL 직접 사용, 인증 불필요
- 파일 경로: `patient-avatars/{patient_id}.webp`
- 환자당 1장, 재업로드 시 기존 파일 덮어쓰기

---

## 2. 백엔드 API

기존 `src/features/shared/backend/route.ts`에 엔드포인트 2개 추가.

### POST /api/shared/patients/:id/avatar

- **요청:** FormData (`file` 필드)
- **처리 흐름:**
  1. 파일 유효성 검증 (크기 2MB 이하, 포맷 jpg/png/webp)
  2. sharp로 200x200px 리사이징 + webp 변환
  3. Supabase Storage에 `{patient_id}.webp`로 업로드 (upsert)
  4. Public URL 생성 + 타임스탬프 쿼리파라미터 (`?t={timestamp}`)
  5. `patients.avatar_url` 업데이트
  6. 응답: `{ success: true, data: { avatar_url: "..." } }`

### DELETE /api/shared/patients/:id/avatar

- **처리 흐름:**
  1. Supabase Storage에서 `{patient_id}.webp` 삭제
  2. `patients.avatar_url`을 NULL로 업데이트
  3. 응답: `{ success: true }`

### 파일 구조

- `src/features/shared/backend/route.ts` — 라우트 추가
- `src/features/shared/backend/service.ts` — 업로드/삭제 비즈니스 로직
- `src/features/shared/backend/schema.ts` — 응답 스키마 추가

---

## 3. 프론트엔드

### 공통 컴포넌트: PatientAvatar

**경로:** `src/features/shared/components/PatientAvatar.tsx`

```typescript
interface PatientAvatarProps {
  avatarUrl: string | null | undefined;
  size: "sm" | "lg";           // sm=28px(w-7), lg=40px(w-10)
  fallbackColorClass: string;  // 예: "bg-purple-100"
  iconColorClass: string;      // 예: "text-purple-600"
}
```

- `avatarUrl` 있으면: `<img>` 원형 표시, `loading="lazy"`, `object-cover`
- `avatarUrl` 없으면: 기존 User 아이콘 (Lucide) 표시
- 이미지 로딩 실패 시: `onError`로 User 아이콘 폴백

### DisplayNameEditButton 다이얼로그 확장

기존 `src/features/shared/components/DisplayNameEditButton.tsx` 수정:

- 다이얼로그 상단에 아바타 미리보기 영역 추가
  - 현재 사진 표시 (없으면 User 아이콘)
  - "사진 변경" 버튼 → hidden file input 트리거
  - 사진이 있을 때 "사진 삭제" 버튼 표시
- 파일 선택 시 미리보기 표시 (URL.createObjectURL)
- 저장 시: 이름 변경 API + 사진 업로드 API 순차 호출
- 파일 제한: 2MB, jpg/png/webp

### React Query Hook

**경로:** `src/features/shared/hooks/useUpdatePatientAvatar.ts`

- `useUploadAvatar`: POST FormData 뮤테이션
- `useDeleteAvatar`: DELETE 뮤테이션
- 성공 시 관련 쿼리 invalidation (기존 useUpdateDisplayName 패턴 동일)

### 적용 대상 컴포넌트 (8개 파일)

기존 `<div className="w-7 h-7 ..."><User /></div>` 패턴을 `<PatientAvatar>`로 교체:

| 컴포넌트 | 사이즈 |
|----------|--------|
| `doctor/components/PatientListPanel.tsx` | sm |
| `doctor/components/ConsultationPanel.tsx` | lg |
| `staff/components/StaffPatientListPanel.tsx` | sm |
| `staff/components/StaffDetailPanel.tsx` | lg |
| `admin/components/AdminPatientListPanel.tsx` | sm |
| `admin/components/AdminDetailPanel.tsx` | lg |
| `nurse/components/NursePatientListPanel.tsx` | sm |
| `nurse/components/NurseDetailPanel.tsx` | lg |

---

## 4. 성능 최적화

| 전략 | 설명 |
|------|------|
| DB 쿼리 영향 없음 | avatar_url은 TEXT 1개 추가, 기존 SELECT에 포함될 뿐 |
| Lazy Loading | `<img loading="lazy">` — 뷰포트 밖 이미지는 로드하지 않음 |
| 브라우저 캐싱 | Public URL은 브라우저가 자동 캐싱, 변경 시 타임스탬프로 무효화 |
| 서버 리사이징 | sharp로 200x200px webp 변환 → 파일 크기 최소화 (보통 10-30KB) |
| 단일 파일 관리 | 환자당 1장 고정 경로 → 파일 정리 불필요 |

---

## 5. 데이터 흐름

### 업로드 흐름

```
사용자 → DisplayNameEditButton 다이얼로그 → 파일 선택
→ 미리보기 표시 → 저장 클릭
→ POST /api/shared/patients/:id/avatar (FormData)
→ Hono 라우터 → service.ts
→ sharp 리사이징(200x200 webp)
→ Supabase Storage 업로드 (upsert)
→ patients.avatar_url 업데이트
→ React Query invalidation → 화면 갱신
```

### 표시 흐름

```
React Query로 환자 목록/상세 조회
→ patient.avatar_url 포함된 데이터
→ PatientAvatar 컴포넌트
→ avatar_url 있으면 <img src={avatar_url} loading="lazy">
→ 없으면 <User /> 아이콘
→ 로딩 실패 시 onError → <User /> 아이콘 폴백
```

---

## 6. 의존성

- **sharp** (npm 패키지) — 서버사이드 이미지 리사이징/변환
  - `npm install sharp`
  - Node.js 런타임 필수 (이미 `runtime = 'nodejs'` 설정됨)

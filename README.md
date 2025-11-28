# 낮병원 환자 관리 시스템 (Daycare Management System)

낮병원에서 환자 출석 관리, 진찰 기록, 직원-의사 간 커뮤니케이션을 효율화하기 위한 웹 애플리케이션입니다.

## 프로젝트 개요

- **목적**: 환자 출석 체크 자동화, 진찰 기록 디지털화, 업무 효율 증대
- **주요 사용자**: 환자, 담당 코디네이터(사회복지사), 간호사, 의사, 관리자
- **기술 스택**: Next.js 15, Supabase (Database), Tailwind CSS, React Query

## 시작하기 (Getting Started)

### 1. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수를 설정하세요.

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인합니다.

## 주요 기능

- **환자용**: 간편 출석 체크, 활력징후 입력
- **직원용**: 담당 환자 관리, 의사 지시사항 확인, 전달사항 작성
- **의사용**: 진찰 기록, 처방 지시, 히스토리 조회
- **관리자**: 직원 및 환자 정보 관리, 통계 조회

## 인증 시스템

이 프로젝트는 Supabase Auth를 사용하지 않고, **자체 구현된 인증 시스템(Custom Auth)**을 사용합니다.
- **직원/의사**: ID/PW 로그인 (관리자가 계정 생성)
- **환자**: 별도 로그인 없이 이름 검색으로 출석 체크 (원내망 접근 권장)

## 데이터베이스

Supabase PostgreSQL을 사용하며, 스키마는 `supabase/migrations` 디렉토리에서 관리됩니다.
초기 스키마 적용을 위해 `supabase/migrations/20241128000000_init_schema.sql`을 실행하세요.

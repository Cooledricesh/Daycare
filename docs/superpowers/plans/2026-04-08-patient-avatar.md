# 환자 프로필 사진 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 환자 프로필 사진을 Supabase Storage에 업로드하고, 4개 페이지(doctor/staff/admin/nurse)에서 표시하는 기능 구현

**Architecture:** Supabase Storage Public 버킷에 환자당 1장 webp 이미지 저장. 기존 shared 백엔드에 upload/delete API 추가, sharp로 서버 리사이징. 공통 PatientAvatar 컴포넌트로 8개 파일의 아바타 교체.

**Tech Stack:** Hono (backend), Supabase Storage, sharp (image resize), React Query (cache), Tailwind CSS

**설계 문서:** `docs/superpowers/specs/2026-04-08-patient-avatar-design.md`

---

## File Map

### 신규 생성
| 파일 | 역할 |
|------|------|
| `supabase/migrations/20260408000001_add_patient_avatar.sql` | avatar_url 컬럼 + Storage 버킷 |
| `src/features/shared/backend/service.ts` | avatar 업로드/삭제 비즈니스 로직 |
| `src/features/shared/components/PatientAvatar.tsx` | 공통 아바타 컴포넌트 |
| `src/features/shared/hooks/usePatientAvatar.ts` | avatar upload/delete React Query 훅 |

### 수정
| 파일 | 변경 내용 |
|------|----------|
| `src/features/shared/backend/route.ts` | POST/DELETE avatar 엔드포인트 추가 |
| `src/features/shared/components/DisplayNameEditButton.tsx` | 아바타 업로드 UI 추가 |
| `src/features/doctor/backend/schema.ts` | WaitingPatient에 avatar_url 추가 |
| `src/features/doctor/backend/service.ts` | select에 avatar_url 추가 |
| `src/features/staff/backend/schema.ts` | PatientSummary/PatientDetail에 avatar_url 추가 |
| `src/features/staff/backend/service.ts` | select에 avatar_url 추가 |
| `src/features/admin/backend/schema.ts` | PatientWithCoordinator에 avatar_url 추가 |
| `src/features/admin/backend/service.ts` | select에 avatar_url 추가 |
| `src/features/nurse/backend/schema.ts` | NursePatientSummary에 avatar_url 추가 |
| `src/features/nurse/backend/service.ts` | select에 avatar_url 추가 |
| `src/features/doctor/components/PatientListPanel.tsx` | PatientAvatar 교체 |
| `src/features/doctor/components/ConsultationPanel.tsx` | PatientAvatar 교체 |
| `src/features/staff/components/StaffPatientListPanel.tsx` | PatientAvatar 교체 |
| `src/features/staff/components/StaffDetailPanel.tsx` | PatientAvatar 교체 |
| `src/features/admin/components/AdminPatientListPanel.tsx` | PatientAvatar 교체 + getPatientDisplayName 통일 |
| `src/features/admin/components/AdminDetailPanel.tsx` | PatientAvatar 교체 + getPatientDisplayName 통일 |
| `src/features/nurse/components/NursePatientListPanel.tsx` | PatientAvatar 교체 + getPatientDisplayName 통일 |
| `src/features/nurse/components/NurseDetailPanel.tsx` | PatientAvatar 교체 + getPatientDisplayName 통일 |

---

### Task 1: DB 마이그레이션 — avatar_url 컬럼 + Storage 버킷

**Files:**
- Create: `supabase/migrations/20260408000001_add_patient_avatar.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 환자 프로필 사진 URL 컬럼 추가
ALTER TABLE patients ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 프로필 사진 Storage 버킷 생성 (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-avatars', 'patient-avatars', true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/migrations/20260408000001_add_patient_avatar.sql
git commit -m "feat(db): 환자 프로필 사진 avatar_url 컬럼 및 Storage 버킷 추가"
```

> **Note:** 사용자가 직접 Supabase에 마이그레이션을 적용해야 합니다. 이후 Task부터는 이 마이그레이션이 적용된 상태를 전제로 합니다.

---

### Task 2: sharp 의존성 설치 및 빌드 검증

**Files:**
- Modify: `package.json`

- [ ] **Step 1: sharp 설치**

```bash
npm install sharp
npm install -D @types/sharp
```

- [ ] **Step 2: 타입 체크 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없이 완료

- [ ] **Step 3: 커밋**

```bash
git add package.json package-lock.json
git commit -m "build: sharp 이미지 처리 라이브러리 추가"
```

---

### Task 3: shared 백엔드 service.ts 생성 — avatar 업로드/삭제

**Files:**
- Create: `src/features/shared/backend/service.ts`

- [ ] **Step 1: service.ts 작성**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import sharp from 'sharp';

const AVATAR_BUCKET = 'patient-avatars';
const AVATAR_MAX_SIZE = 200;
const AVATAR_QUALITY = 80;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

function isAllowedMimeType(type: string): type is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

export async function uploadPatientAvatar(
  supabase: SupabaseClient<Database>,
  patientId: string,
  file: File,
): Promise<{ avatarUrl: string }> {
  // 파일 유효성 검증
  if (!isAllowedMimeType(file.type)) {
    throw new AvatarError('INVALID_FILE_TYPE', '지원하지 않는 파일 형식입니다. (jpg, png, webp만 가능)');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new AvatarError('FILE_TOO_LARGE', '파일 크기가 2MB를 초과합니다.');
  }

  // sharp로 리사이징 + webp 변환
  const arrayBuffer = await file.arrayBuffer();
  const resizedBuffer = await sharp(Buffer.from(arrayBuffer))
    .resize(AVATAR_MAX_SIZE, AVATAR_MAX_SIZE, { fit: 'cover' })
    .webp({ quality: AVATAR_QUALITY })
    .toBuffer();

  const filePath = `${patientId}.webp`;

  // Storage 업로드 (upsert)
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, resizedBuffer, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (uploadError) {
    throw new AvatarError('UPLOAD_FAILED', `Storage 업로드 실패: ${uploadError.message}`);
  }

  // Public URL 생성 (base URL, 타임스탬프 미포함)
  const { data: urlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(filePath);

  const avatarUrl = urlData.publicUrl;

  // DB 업데이트
  const { error: dbError } = await supabase
    .from('patients')
    .update({ avatar_url: avatarUrl })
    .eq('id', patientId);

  if (dbError) {
    throw new AvatarError('DB_UPDATE_FAILED', `DB 업데이트 실패: ${dbError.message}`);
  }

  return { avatarUrl };
}

export async function deletePatientAvatar(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<void> {
  const filePath = `${patientId}.webp`;

  // Storage 삭제 시도 — 파일이 없어도 에러 무시
  await supabase.storage.from(AVATAR_BUCKET).remove([filePath]);

  // DB NULL 처리 (항상 성공으로 간주)
  const { error: dbError } = await supabase
    .from('patients')
    .update({ avatar_url: null })
    .eq('id', patientId);

  if (dbError) {
    throw new AvatarError('DB_UPDATE_FAILED', `DB 업데이트 실패: ${dbError.message}`);
  }
}

export class AvatarError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AvatarError';
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/features/shared/backend/service.ts
git commit -m "feat(shared): avatar 업로드/삭제 서비스 로직 구현"
```

---

### Task 4: shared 백엔드 route.ts — avatar 엔드포인트 추가

**Files:**
- Modify: `src/features/shared/backend/route.ts`

- [ ] **Step 1: route.ts에 avatar 엔드포인트 추가**

파일 상단 import에 추가:

```typescript
import { uploadPatientAvatar, deletePatientAvatar, AvatarError } from './service';
```

기존 display-name 엔드포인트 아래에 추가:

```typescript
// ─── 환자 프로필 사진 업로드 ───
sharedRoutes.post('/patients/:id/avatar', async (c) => {
  const supabase = c.get('supabase');
  const patientId = c.req.param('id');

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return respond(c, failure(400, 'FILE_REQUIRED', '파일을 첨부해주세요'));
  }

  try {
    const result = await uploadPatientAvatar(supabase, patientId, file);
    // 응답에서만 cache busting URL 반환
    const cacheBustUrl = `${result.avatarUrl}?t=${Date.now()}`;
    return respond(c, success({ avatar_url: cacheBustUrl }, 200));
  } catch (err) {
    if (err instanceof AvatarError) {
      const status = err.code === 'INVALID_FILE_TYPE' || err.code === 'FILE_TOO_LARGE' ? 400 : 500;
      return respond(c, failure(status, err.code, err.message));
    }
    throw err;
  }
});

// ─── 환자 프로필 사진 삭제 ───
sharedRoutes.delete('/patients/:id/avatar', async (c) => {
  const supabase = c.get('supabase');
  const patientId = c.req.param('id');

  try {
    await deletePatientAvatar(supabase, patientId);
    return respond(c, success(null, 200));
  } catch (err) {
    if (err instanceof AvatarError) {
      return respond(c, failure(500, err.code, err.message));
    }
    throw err;
  }
});
```

- [ ] **Step 2: 타입 체크 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없이 완료

- [ ] **Step 3: 커밋**

```bash
git add src/features/shared/backend/route.ts
git commit -m "feat(shared): 환자 프로필 사진 업로드/삭제 API 엔드포인트 추가"
```

---

### Task 5: 각 feature schema/service에 avatar_url 반영

**Files:**
- Modify: `src/features/doctor/backend/schema.ts`
- Modify: `src/features/doctor/backend/service.ts`
- Modify: `src/features/staff/backend/schema.ts`
- Modify: `src/features/staff/backend/service.ts`
- Modify: `src/features/admin/backend/schema.ts`
- Modify: `src/features/admin/backend/service.ts`
- Modify: `src/features/nurse/backend/schema.ts`
- Modify: `src/features/nurse/backend/service.ts`

- [ ] **Step 1: Doctor schema — WaitingPatient에 avatar_url 추가**

`src/features/doctor/backend/schema.ts`에서 `WaitingPatient` 인터페이스에 추가:

```typescript
export interface WaitingPatient {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;  // 추가
  gender: 'M' | 'F' | null;
  // ... 나머지 동일
}
```

- [ ] **Step 2: Doctor service — select에 avatar_url 추가**

`src/features/doctor/backend/service.ts`에서 환자 목록 조회 select에 `avatar_url` 추가:

```typescript
const { data: allPatients, error: patientsError } = await supabase
  .from('patients')
  .select(`
    id,
    name,
    display_name,
    avatar_url,
    gender,
    room_number,
    coordinator:coordinator_id(name)
  `)
  .eq('status', 'active')
  .order('room_number', { ascending: true })
  .returns<PatientWithCoordinator[]>();
```

- [ ] **Step 3: Staff schema — PatientSummary/PatientDetail에 avatar_url 추가**

`src/features/staff/backend/schema.ts`:

```typescript
export type PatientSummary = {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;  // 추가
  gender: string | null;
  // ... 나머지 동일
};

export type PatientDetail = {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;  // 추가
  gender: string | null;
  // ... 나머지 동일
};
```

- [ ] **Step 4: Staff service — select에 avatar_url 추가**

`src/features/staff/backend/service.ts`에서 환자 조회 select에 `avatar_url` 추가:

목록 조회 (`getMyPatients`):
```typescript
let patientsQuery = supabase
  .from('patients')
  .select('id, name, display_name, avatar_url, gender')
  .eq('status', 'active');
```

상세 조회 (`getPatientDetail`):
```typescript
supabase.from('patients')
  .select('id, name, display_name, avatar_url, gender, coordinator_id')
  .eq('id', params.patient_id)
  .single(),
```

- [ ] **Step 5: Admin schema — PatientWithCoordinator에 avatar_url 추가**

`src/features/admin/backend/schema.ts`:

```typescript
export interface PatientWithCoordinator {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;  // 추가
  gender: 'M' | 'F' | null;
  // ... 나머지 동일
}
```

- [ ] **Step 6: Admin service — select에 avatar_url 추가**

`src/features/admin/backend/service.ts`에서 환자 목록 조회 select에 `avatar_url` 추가:

```typescript
let queryBuilder = supabase
  .from('patients')
  .select(`
    id,
    name,
    display_name,
    avatar_url,
    gender,
    room_number,
    patient_id_no,
    coordinator_id,
    doctor_id,
    status,
    memo,
    created_at,
    updated_at,
    coordinator:staff!coordinator_id(name),
    doctor:staff!doctor_id(name),
    scheduled_patterns(day_of_week)
  `, { count: 'exact' });
```

- [ ] **Step 7: Nurse schema — NursePatientSummary에 avatar_url 추가**

`src/features/nurse/backend/schema.ts`:

```typescript
export type NursePatientSummary = {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;  // 추가
  gender: string | null;
  // ... 나머지 동일
};
```

- [ ] **Step 8: Nurse service — select에 avatar_url 추가**

`src/features/nurse/backend/service.ts`:

```typescript
const { data: patients, error: patientsError } = await supabase
  .from('patients')
  .select('id, name, display_name, avatar_url, gender, coordinator:staff!patients_coordinator_id_fkey(name)')
  .eq('status', 'active')
  .order('name')
  .returns<NursePatientRow[]>();
```

- [ ] **Step 9: 타입 체크 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없이 완료. 만약 `NursePatientRow` 등 내부 타입에도 `avatar_url`이 필요하면 해당 타입도 수정.

- [ ] **Step 10: 커밋**

```bash
git add src/features/doctor/backend/schema.ts src/features/doctor/backend/service.ts \
  src/features/staff/backend/schema.ts src/features/staff/backend/service.ts \
  src/features/admin/backend/schema.ts src/features/admin/backend/service.ts \
  src/features/nurse/backend/schema.ts src/features/nurse/backend/service.ts
git commit -m "feat(schema): 전체 feature에 avatar_url 필드 반영"
```

---

### Task 6: PatientAvatar 공통 컴포넌트 생성

**Files:**
- Create: `src/features/shared/components/PatientAvatar.tsx`

- [ ] **Step 1: PatientAvatar 컴포넌트 작성**

```typescript
'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE_MAP = {
  sm: { container: 'w-7 h-7', icon: 'w-3.5 h-3.5' },
  lg: { container: 'w-10 h-10', icon: 'w-5 h-5' },
} as const;

interface PatientAvatarProps {
  avatarUrl: string | null | undefined;
  size: 'sm' | 'lg';
  fallbackColorClass: string;
  iconColorClass: string;
}

export function PatientAvatar({
  avatarUrl,
  size,
  fallbackColorClass,
  iconColorClass,
}: PatientAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClasses = SIZE_MAP[size];
  const showImage = avatarUrl && !imgError;

  return (
    <div
      className={cn(
        'rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden',
        sizeClasses.container,
        !showImage && fallbackColorClass,
      )}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <User className={cn(sizeClasses.icon, iconColorClass)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/features/shared/components/PatientAvatar.tsx
git commit -m "feat(shared): PatientAvatar 공통 아바타 컴포넌트 생성"
```

---

### Task 7: avatar React Query 훅 생성

**Files:**
- Create: `src/features/shared/hooks/usePatientAvatar.ts`

- [ ] **Step 1: usePatientAvatar 훅 작성**

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import { staffKeys } from '../../staff/hooks/query-keys';
import { adminKeys } from '../../admin/hooks/query-keys';
import { doctorKeys } from '../../doctor/hooks/query-keys';
import { nurseKeys } from '../../nurse/hooks/query-keys';

function useInvalidatePatientQueries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: staffKeys.all });
    queryClient.invalidateQueries({ queryKey: adminKeys.all });
    queryClient.invalidateQueries({ queryKey: doctorKeys.all });
    queryClient.invalidateQueries({ queryKey: nurseKeys.all });
    queryClient.invalidateQueries({ queryKey: ['patients'] });
  };
}

export function useUploadAvatar() {
  const invalidate = useInvalidatePatientQueries();

  return useMutation({
    mutationFn: async ({ patientId, file }: { patientId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post(`/api/shared/patients/${patientId}/avatar`, formData);
      return response.data as { avatar_url: string };
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAvatar() {
  const invalidate = useInvalidatePatientQueries();

  return useMutation({
    mutationFn: async ({ patientId }: { patientId: string }) => {
      await apiClient.delete(`/api/shared/patients/${patientId}/avatar`);
    },
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 2: 타입 체크 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add src/features/shared/hooks/usePatientAvatar.ts
git commit -m "feat(shared): avatar 업로드/삭제 React Query 훅 추가"
```

---

### Task 8: DisplayNameEditButton 다이얼로그에 아바타 업로드 UI 추가

**Files:**
- Modify: `src/features/shared/components/DisplayNameEditButton.tsx`

- [ ] **Step 1: DisplayNameEditButton props 및 import 수정**

props에 `currentAvatarUrl` 추가, avatar 훅 import:

```typescript
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, User, Camera, Trash2 } from 'lucide-react';
import { useUpdateDisplayName } from '../hooks/useUpdateDisplayName';
import { useUploadAvatar, useDeleteAvatar } from '../hooks/usePatientAvatar';
import { useToast } from '@/hooks/use-toast';
import { extractApiErrorMessage } from '@/lib/remote/api-client';

interface DisplayNameEditButtonProps {
  patientId: string;
  patientName: string;
  currentDisplayName: string | null;
  currentAvatarUrl: string | null;
  variant?: 'icon' | 'text';
}
```

- [ ] **Step 2: 컴포넌트 본문 수정 — 상태 + 핸들러 추가**

기존 `handleSave` 로직을 아바타 업로드와 분리하여 처리:

```typescript
export function DisplayNameEditButton({
  patientId,
  patientName,
  currentDisplayName,
  currentAvatarUrl,
  variant = 'icon',
}: DisplayNameEditButtonProps) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [wantsDelete, setWantsDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: updateName, isPending: isNamePending } = useUpdateDisplayName();
  const { mutateAsync: uploadAvatar, isPending: isUploadPending } = useUploadAvatar();
  const { mutateAsync: deleteAvatar, isPending: isDeletePending } = useDeleteAvatar();
  const { toast } = useToast();

  const isPending = isNamePending || isUploadPending || isDeletePending;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setDisplayName(currentDisplayName || '');
      setSelectedFile(null);
      setPreviewUrl(null);
      setWantsDelete(false);
    } else if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setOpen(isOpen);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: '파일 크기 초과', description: '2MB 이하 파일만 업로드 가능합니다.', variant: 'destructive' });
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: '지원하지 않는 형식', description: 'jpg, png, webp 파일만 가능합니다.', variant: 'destructive' });
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setWantsDelete(false);
  };

  const handleDeletePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setWantsDelete(true);
  };

  const handleSave = async () => {
    const trimmed = displayName.trim();
    const nameValue = trimmed === '' || trimmed === patientName ? null : trimmed;

    // 1. 이름 변경
    try {
      await updateName({ patientId, displayName: nameValue });
      toast({
        title: '표시명 변경 완료',
        description: nameValue
          ? `"${patientName}" → "${nameValue}" 로 변경되었습니다.`
          : `표시명이 원래 이름으로 복원되었습니다.`,
      });
    } catch (error) {
      const message = extractApiErrorMessage(error, '표시명 변경에 실패했습니다.');
      toast({ title: '변경 실패', description: message, variant: 'destructive' });
      return;
    }

    // 2. 사진 업로드/삭제
    if (selectedFile) {
      try {
        await uploadAvatar({ patientId, file: selectedFile });
        toast({ title: '사진 업로드 완료' });
      } catch (error) {
        const message = extractApiErrorMessage(error, '사진 업로드에 실패했습니다.');
        toast({ title: '사진 업로드 실패', description: message, variant: 'destructive' });
      }
    } else if (wantsDelete && currentAvatarUrl) {
      try {
        await deleteAvatar({ patientId });
        toast({ title: '사진 삭제 완료' });
      } catch (error) {
        const message = extractApiErrorMessage(error, '사진 삭제에 실패했습니다.');
        toast({ title: '사진 삭제 실패', description: message, variant: 'destructive' });
      }
    }

    setOpen(false);
  };

  const handleReset = async () => {
    try {
      await updateName({ patientId, displayName: null });
      toast({
        title: '표시명 초기화',
        description: `원래 이름 "${patientName}" 으로 복원되었습니다.`,
      });
      setDisplayName('');
      setOpen(false);
    } catch (error) {
      const message = extractApiErrorMessage(error, '초기화에 실패했습니다.');
      toast({ title: '초기화 실패', description: message, variant: 'destructive' });
    }
  };

  // 미리보기에 표시할 이미지 URL 결정
  const displayAvatarUrl = wantsDelete ? null : (previewUrl || currentAvatarUrl);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="h-3 w-3 mr-1" />
            표시명 변경
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>환자 프로필 편집</DialogTitle>
          <DialogDescription>
            프로필 사진과 표시명을 변경합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* 아바타 미리보기 + 업로드 */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {displayAvatarUrl ? (
                <img src={displayAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                <Camera className="h-3 w-3 mr-1" />
                사진 변경
              </Button>
              {(currentAvatarUrl || previewUrl) && !wantsDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={handleDeletePhoto}
                  disabled={isPending}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  사진 삭제
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* 기존 이름 편집 UI */}
          <div>
            <Label className="text-sm text-gray-500">실제 이름 (병록)</Label>
            <p className="text-sm font-medium mt-1">{patientName}</p>
          </div>
          <div>
            <Label htmlFor="display-name">표시명</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={`예: ${patientName}A, ${patientName}B`}
              className="mt-1"
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPending) {
                  handleSave();
                }
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              비워두면 원래 이름으로 표시됩니다.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {currentDisplayName && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isPending}
            >
              원래 이름으로 복원
            </Button>
          )}
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 타입 체크 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/features/shared/components/DisplayNameEditButton.tsx
git commit -m "feat(shared): DisplayNameEditButton에 아바타 업로드 UI 추가"
```

---

### Task 9: Doctor 컴포넌트에 PatientAvatar 적용

**Files:**
- Modify: `src/features/doctor/components/PatientListPanel.tsx`
- Modify: `src/features/doctor/components/ConsultationPanel.tsx`

- [ ] **Step 1: PatientListPanel.tsx — 사이드바 아바타 교체**

import 추가:
```typescript
import { PatientAvatar } from '@/features/shared/components/PatientAvatar';
```

기존 아바타 부분 (약 line 187-189):
```tsx
<div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
  <User className="w-3.5 h-3.5 text-gray-500" />
</div>
```

교체:
```tsx
<PatientAvatar
  avatarUrl={patient.avatar_url}
  size="sm"
  fallbackColorClass="bg-gray-100"
  iconColorClass="text-gray-500"
/>
```

불필요해진 `User` import를 제거 (다른 곳에서 사용하지 않는 경우).

- [ ] **Step 2: ConsultationPanel.tsx — 상세 패널 아바타 교체**

import 추가:
```typescript
import { PatientAvatar } from '@/features/shared/components/PatientAvatar';
```

기존 아바타 부분 (약 line 164-167):
```tsx
<div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
  <User className="w-5 h-5 text-purple-600" />
</div>
```

교체:
```tsx
<PatientAvatar
  avatarUrl={patient.avatar_url}
  size="lg"
  fallbackColorClass="bg-purple-100"
  iconColorClass="text-purple-600"
/>
```

DisplayNameEditButton에 `currentAvatarUrl` prop 추가 (이미 사용하고 있다면):
```tsx
<DisplayNameEditButton
  patientId={patient.id}
  patientName={patient.name}
  currentDisplayName={patient.display_name}
  currentAvatarUrl={patient.avatar_url}
/>
```

- [ ] **Step 3: 타입 체크 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/features/doctor/components/PatientListPanel.tsx src/features/doctor/components/ConsultationPanel.tsx
git commit -m "feat(doctor): 진찰 화면에 PatientAvatar 적용"
```

---

### Task 10: Staff 컴포넌트에 PatientAvatar 적용

**Files:**
- Modify: `src/features/staff/components/StaffPatientListPanel.tsx`
- Modify: `src/features/staff/components/StaffDetailPanel.tsx`

- [ ] **Step 1: StaffPatientListPanel.tsx — 사이드바 아바타 교체**

import 추가:
```typescript
import { PatientAvatar } from '@/features/shared/components/PatientAvatar';
```

기존 아바타 부분 (약 line 398-428, 일반 모드의 User 아이콘만 교체 — Checkbox 모드는 유지):
```tsx
<PatientAvatar
  avatarUrl={patient.avatar_url}
  size="sm"
  fallbackColorClass="bg-gray-100"
  iconColorClass="text-gray-500"
/>
```

주의: Staff 사이드바는 attendance/consultation 모드에서 Checkbox로 대체됨. 일반 모드(else 분기)의 User 아이콘만 PatientAvatar로 교체.

- [ ] **Step 2: StaffDetailPanel.tsx — 상세 패널 아바타 교체**

import 추가:
```typescript
import { PatientAvatar } from '@/features/shared/components/PatientAvatar';
```

기존 아바타 (약 line 107-109):
```tsx
<div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
  <User className="w-5 h-5 text-emerald-600" />
</div>
```

교체:
```tsx
<PatientAvatar
  avatarUrl={patient.avatar_url}
  size="lg"
  fallbackColorClass="bg-emerald-100"
  iconColorClass="text-emerald-600"
/>
```

DisplayNameEditButton에 `currentAvatarUrl` prop 추가:
```tsx
<DisplayNameEditButton
  patientId={patient.id}
  patientName={patient.name}
  currentDisplayName={patient.display_name}
  currentAvatarUrl={patient.avatar_url}
/>
```

- [ ] **Step 3: 타입 체크 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/features/staff/components/StaffPatientListPanel.tsx src/features/staff/components/StaffDetailPanel.tsx
git commit -m "feat(staff): 코디네이터 대시보드에 PatientAvatar 적용"
```

---

### Task 11: Admin 컴포넌트에 PatientAvatar 적용 + display_name 통일

**Files:**
- Modify: `src/features/admin/components/AdminPatientListPanel.tsx`
- Modify: `src/features/admin/components/AdminDetailPanel.tsx`

- [ ] **Step 1: AdminPatientListPanel.tsx — 아바타 교체 + display_name 통일**

import 추가:
```typescript
import { PatientAvatar } from '@/features/shared/components/PatientAvatar';
import { getPatientDisplayName } from '@/lib/patient';
```

기존 아바타 부분 (약 line 179-181) 교체:
```tsx
<PatientAvatar
  avatarUrl={patient.avatar_url}
  size="sm"
  fallbackColorClass="bg-gray-100"
  iconColorClass="text-gray-500"
/>
```

이름 표시 (약 line 184) 변경:
```tsx
// Before:
<span className="font-medium text-sm truncate">{patient.name}</span>
// After:
<span className="font-medium text-sm truncate">{getPatientDisplayName(patient)}</span>
```

- [ ] **Step 2: AdminDetailPanel.tsx — 아바타 교체 + display_name 통일**

import 추가:
```typescript
import { PatientAvatar } from '@/features/shared/components/PatientAvatar';
import { getPatientDisplayName } from '@/lib/patient';
```

기존 아바타 (약 line 115-117) 교체:
```tsx
<PatientAvatar
  avatarUrl={patient.avatar_url}
  size="lg"
  fallbackColorClass="bg-indigo-100"
  iconColorClass="text-indigo-600"
/>
```

이름 표시 (약 line 120) 변경:
```tsx
// Before:
<h2 className="text-xl font-bold">{patient.name}</h2>
// After:
<h2 className="text-xl font-bold">{getPatientDisplayName(patient)}</h2>
```

DisplayNameEditButton이 있다면 `currentAvatarUrl` prop 추가. 없다면 상세 패널 헤더에 추가:
```tsx
<DisplayNameEditButton
  patientId={patient.id}
  patientName={patient.name}
  currentDisplayName={patient.display_name}
  currentAvatarUrl={patient.avatar_url}
/>
```

- [ ] **Step 3: 타입 체크 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/features/admin/components/AdminPatientListPanel.tsx src/features/admin/components/AdminDetailPanel.tsx
git commit -m "feat(admin): 관리자 대시보드에 PatientAvatar 적용 및 display_name 통일"
```

---

### Task 12: Nurse 컴포넌트에 PatientAvatar 적용 + display_name 통일

**Files:**
- Modify: `src/features/nurse/components/NursePatientListPanel.tsx`
- Modify: `src/features/nurse/components/NurseDetailPanel.tsx`

- [ ] **Step 1: NursePatientListPanel.tsx — 아바타 교체 + display_name 통일**

import 추가:
```typescript
import { PatientAvatar } from '@/features/shared/components/PatientAvatar';
import { getPatientDisplayName } from '@/lib/patient';
```

기존 아바타 부분 (약 line 183-185) 교체:
```tsx
<PatientAvatar
  avatarUrl={patient.avatar_url}
  size="sm"
  fallbackColorClass="bg-gray-100"
  iconColorClass="text-gray-500"
/>
```

이름 표시 (약 line 188) 변경:
```tsx
// Before:
<span className="font-medium text-sm truncate">{patient.name}</span>
// After:
<span className="font-medium text-sm truncate">{getPatientDisplayName(patient)}</span>
```

- [ ] **Step 2: NurseDetailPanel.tsx — 아바타 교체 + display_name 통일**

import 추가:
```typescript
import { PatientAvatar } from '@/features/shared/components/PatientAvatar';
import { getPatientDisplayName } from '@/lib/patient';
```

기존 아바타 (약 line 109-111) 교체:
```tsx
<PatientAvatar
  avatarUrl={patient.avatar_url}
  size="lg"
  fallbackColorClass="bg-emerald-100"
  iconColorClass="text-emerald-600"
/>
```

이름 표시 (약 line 114) 변경:
```tsx
// Before:
<h2 className="text-xl font-bold">{patient.name}</h2>
// After:
<h2 className="text-xl font-bold">{getPatientDisplayName(patient)}</h2>
```

DisplayNameEditButton이 있다면 `currentAvatarUrl` prop 추가.

- [ ] **Step 3: 타입 체크 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/features/nurse/components/NursePatientListPanel.tsx src/features/nurse/components/NurseDetailPanel.tsx
git commit -m "feat(nurse): 간호사 처방 화면에 PatientAvatar 적용 및 display_name 통일"
```

---

### Task 13: 전체 빌드 검증 및 미사용 import 정리

**Files:**
- 위에서 수정한 모든 파일

- [ ] **Step 1: 빌드 검증**

```bash
npx next build
```

Expected: 에러 없이 빌드 완료

- [ ] **Step 2: 미사용 import 정리**

각 컴포넌트에서 `User` (lucide-react)가 PatientAvatar로 대체되어 더 이상 사용되지 않는 경우 import 제거.

확인 대상 파일:
- `src/features/doctor/components/PatientListPanel.tsx`
- `src/features/doctor/components/ConsultationPanel.tsx`
- `src/features/staff/components/StaffPatientListPanel.tsx`
- `src/features/staff/components/StaffDetailPanel.tsx`
- `src/features/admin/components/AdminPatientListPanel.tsx`
- `src/features/admin/components/AdminDetailPanel.tsx`
- `src/features/nurse/components/NursePatientListPanel.tsx`
- `src/features/nurse/components/NurseDetailPanel.tsx`

주의: `User` 아이콘이 해당 파일에서 다른 곳에도 사용되면 제거하지 않는다.

- [ ] **Step 3: ESLint 확인**

```bash
npx eslint src/features/shared/ src/features/doctor/ src/features/staff/ src/features/admin/ src/features/nurse/ --ext .ts,.tsx
```

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "chore: 미사용 import 정리 및 빌드 검증"
```

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AvatarError, AVATAR_ERROR_CODES } from './error';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { AvatarStorageConfig } from './service';

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  })),
}));

const { uploadPatientAvatar, deletePatientAvatar } = await import('./service');

const storage: AvatarStorageConfig = {
  url: 'https://daycare-api.example.com',
  apiKey: 'test-api-key',
};

function createMockFile(options: { type?: string; size?: number } = {}): File {
  const { type = 'image/jpeg', size = 1024 } = options;
  const buffer = Buffer.alloc(size);
  const file = new File([buffer], 'test.jpg', { type });
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn().mockResolvedValue(buffer.buffer),
  });
  return file;
}

interface SupabaseMock {
  supabase: SupabaseClient<Database>;
  mockEq: ReturnType<typeof vi.fn>;
  mockUpdate: ReturnType<typeof vi.fn>;
}

function createMockSupabase(): SupabaseMock {
  const mockEq = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  const supabase = {
    from: vi.fn(() => ({ update: mockUpdate })),
  } as unknown as SupabaseClient<Database>;
  return { supabase, mockEq, mockUpdate };
}

function mockFetch(status = 201): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('shared/uploadPatientAvatar', () => {
  let mock: SupabaseMock;

  beforeEach(() => {
    mock = createMockSupabase();
    mockFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('유효한 파일이면 NAS gateway에 리사이즈 결과를 업로드하고 공개 URL을 저장한다', async () => {
    const result = await uploadPatientAvatar(mock.supabase, storage, 'test-id', createMockFile());

    expect(result.avatarUrl).toBe(
      'https://daycare-api.example.com/storage/v1/object/public/patient-avatars/test-id.webp',
    );
    expect(fetch).toHaveBeenCalledWith(
      'https://daycare-api.example.com/storage/v1/object/patient-avatars/test-id.webp',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ apikey: 'test-api-key', 'Content-Type': 'image/webp' }),
      }),
    );
    expect(mock.mockUpdate).toHaveBeenCalledWith({ avatar_url: result.avatarUrl });
  });

  it('허용되지 않는 파일 형식이면 INVALID_FILE_TYPE 에러', async () => {
    await expect(
      uploadPatientAvatar(mock.supabase, storage, 'test-id', createMockFile({ type: 'image/gif' })),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof AvatarError && err.code === AVATAR_ERROR_CODES.INVALID_FILE_TYPE,
    );
  });

  it('파일 크기가 2MB를 초과하면 FILE_TOO_LARGE 에러', async () => {
    await expect(
      uploadPatientAvatar(
        mock.supabase,
        storage,
        'test-id',
        createMockFile({ type: 'image/jpeg', size: 3 * 1024 * 1024 }),
      ),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof AvatarError && err.code === AVATAR_ERROR_CODES.FILE_TOO_LARGE,
    );
  });

  it('Storage 업로드 실패 시 UPLOAD_FAILED 에러', async () => {
    mockFetch(500);
    await expect(
      uploadPatientAvatar(mock.supabase, storage, 'test-id', createMockFile()),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof AvatarError && err.code === AVATAR_ERROR_CODES.UPLOAD_FAILED,
    );
  });

  it('DB 업데이트 실패 시 업로드 파일을 정리하고 DB_UPDATE_FAILED 에러', async () => {
    mock.mockEq.mockResolvedValueOnce({ error: { message: 'db error' } });
    await expect(
      uploadPatientAvatar(mock.supabase, storage, 'test-id', createMockFile()),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof AvatarError && err.code === AVATAR_ERROR_CODES.DB_UPDATE_FAILED,
    );
    expect(fetch).toHaveBeenLastCalledWith(
      'https://daycare-api.example.com/storage/v1/object/patient-avatars/test-id.webp',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('shared/deletePatientAvatar', () => {
  let mock: SupabaseMock;

  beforeEach(() => {
    mock = createMockSupabase();
    mockFetch(204);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Storage 삭제 후 DB avatar_url을 null로 업데이트한다', async () => {
    await deletePatientAvatar(mock.supabase, storage, 'test-id');
    expect(fetch).toHaveBeenCalledWith(
      'https://daycare-api.example.com/storage/v1/object/patient-avatars/test-id.webp',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(mock.mockUpdate).toHaveBeenCalledWith({ avatar_url: null });
  });

  it('Storage 파일이 없어도 DB를 null로 업데이트한다', async () => {
    mockFetch(404);
    await expect(deletePatientAvatar(mock.supabase, storage, 'test-id')).resolves.toBeUndefined();
    expect(mock.mockUpdate).toHaveBeenCalledWith({ avatar_url: null });
  });

  it('DB 업데이트 실패 시 DB_UPDATE_FAILED 에러', async () => {
    mock.mockEq.mockResolvedValueOnce({ error: { message: 'db error' } });
    await expect(deletePatientAvatar(mock.supabase, storage, 'test-id')).rejects.toSatisfy(
      (err: unknown) => err instanceof AvatarError && err.code === AVATAR_ERROR_CODES.DB_UPDATE_FAILED,
    );
  });
});

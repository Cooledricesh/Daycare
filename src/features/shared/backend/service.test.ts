import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AvatarError, AVATAR_ERROR_CODES } from './error';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  })),
}));

const { uploadPatientAvatar, deletePatientAvatar } = await import('./service');

function createMockFile(options: { type?: string; size?: number } = {}): File {
  const { type = 'image/jpeg', size = 1024 } = options;
  const buffer = Buffer.alloc(size);
  // Node.js 테스트 환경에서 File.arrayBuffer()가 동작하지 않으므로 수동으로 주입
  const file = new File([buffer], 'test.jpg', { type });
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn().mockResolvedValue(buffer.buffer),
  });
  return file;
}

interface StorageMock {
  upload: ReturnType<typeof vi.fn>;
  getPublicUrl: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

interface SupabaseMock {
  supabase: SupabaseClient<Database>;
  storageMock: StorageMock;
  mockEq: ReturnType<typeof vi.fn>;
  mockUpdate: ReturnType<typeof vi.fn>;
}

function createMockSupabaseWithStorage(): SupabaseMock {
  const mockEq = vi.fn();
  const mockUpdate = vi.fn();

  const storageMock: StorageMock = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/patient-avatars/test-id.webp' },
    }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  };

  const storageFromMock = vi.fn(() => storageMock);

  // DB 체인: .from().update().eq() → { error }
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });

  const fromMock = vi.fn(() => ({ update: mockUpdate }));

  const supabase = {
    from: fromMock,
    storage: { from: storageFromMock },
  } as unknown as SupabaseClient<Database>;

  return { supabase, storageMock, mockEq, mockUpdate };
}

describe('shared/uploadPatientAvatar', () => {
  let mock: SupabaseMock;

  beforeEach(() => {
    mock = createMockSupabaseWithStorage();
  });

  it('유효한 파일이면 리사이즈 후 업로드하고 avatarUrl을 반환한다', async () => {
    const file = createMockFile({ type: 'image/jpeg', size: 1024 });

    const result = await uploadPatientAvatar(mock.supabase, 'test-id', file);

    expect(result.avatarUrl).toBe(
      'https://example.com/patient-avatars/test-id.webp',
    );
    expect(mock.storageMock.upload).toHaveBeenCalledWith(
      'test-id.webp',
      expect.any(Buffer),
      { contentType: 'image/webp', upsert: true },
    );
    expect(mock.mockUpdate).toHaveBeenCalledWith({ avatar_url: result.avatarUrl });
  });

  it('허용되지 않는 파일 형식이면 INVALID_FILE_TYPE 에러', async () => {
    const file = createMockFile({ type: 'image/gif' });

    await expect(uploadPatientAvatar(mock.supabase, 'test-id', file)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AvatarError &&
        err.code === AVATAR_ERROR_CODES.INVALID_FILE_TYPE,
    );
  });

  it('파일 크기가 2MB를 초과하면 FILE_TOO_LARGE 에러', async () => {
    const file = createMockFile({ type: 'image/jpeg', size: 3 * 1024 * 1024 });

    await expect(uploadPatientAvatar(mock.supabase, 'test-id', file)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AvatarError &&
        err.code === AVATAR_ERROR_CODES.FILE_TOO_LARGE,
    );
  });

  it('Storage 업로드 실패 시 UPLOAD_FAILED 에러', async () => {
    mock.storageMock.upload.mockResolvedValueOnce({
      error: { message: 'bucket not found' },
    });
    const file = createMockFile();

    await expect(uploadPatientAvatar(mock.supabase, 'test-id', file)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AvatarError &&
        err.code === AVATAR_ERROR_CODES.UPLOAD_FAILED,
    );
  });

  it('DB 업데이트 실패 시 DB_UPDATE_FAILED 에러', async () => {
    mock.mockEq.mockResolvedValueOnce({ error: { message: 'db error' } });
    const file = createMockFile();

    await expect(uploadPatientAvatar(mock.supabase, 'test-id', file)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AvatarError &&
        err.code === AVATAR_ERROR_CODES.DB_UPDATE_FAILED,
    );
  });
});

describe('shared/deletePatientAvatar', () => {
  let mock: SupabaseMock;

  beforeEach(() => {
    mock = createMockSupabaseWithStorage();
  });

  it('Storage 삭제 후 DB avatar_url을 null로 업데이트한다', async () => {
    await deletePatientAvatar(mock.supabase, 'test-id');

    expect(mock.storageMock.remove).toHaveBeenCalledWith(['test-id.webp']);
    expect(mock.mockUpdate).toHaveBeenCalledWith({ avatar_url: null });
  });

  it('Storage 파일이 없어도 에러 없이 DB를 null로 업데이트한다', async () => {
    mock.storageMock.remove.mockResolvedValueOnce({
      error: { message: 'Object not found' },
    });

    await expect(deletePatientAvatar(mock.supabase, 'test-id')).resolves.toBeUndefined();
    expect(mock.mockUpdate).toHaveBeenCalledWith({ avatar_url: null });
  });

  it('DB 업데이트 실패 시 DB_UPDATE_FAILED 에러', async () => {
    mock.mockEq.mockResolvedValueOnce({ error: { message: 'db error' } });

    await expect(deletePatientAvatar(mock.supabase, 'test-id')).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AvatarError &&
        err.code === AVATAR_ERROR_CODES.DB_UPDATE_FAILED,
    );
  });
});

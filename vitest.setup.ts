import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 환경변수를 모듈 로드 전에 설정
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.JWT_SECRET_KEY = 'test-secret-key-for-vitest-testing';
process.env.JWT_EXPIRES_IN = '8h';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Supabase 모킹
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

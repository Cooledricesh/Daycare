import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export interface MockSupabaseChain {
  supabase: SupabaseClient<Database>;
  mockFrom: ReturnType<typeof vi.fn>;
  mockSelect: ReturnType<typeof vi.fn>;
  mockInsert: ReturnType<typeof vi.fn>;
  mockUpdate: ReturnType<typeof vi.fn>;
  mockDelete: ReturnType<typeof vi.fn>;
  mockUpsert: ReturnType<typeof vi.fn>;
  mockEq: ReturnType<typeof vi.fn>;
  mockSingle: ReturnType<typeof vi.fn>;
  mockMaybeSingle: ReturnType<typeof vi.fn>;
  mockOrder: ReturnType<typeof vi.fn>;
  mockLimit: ReturnType<typeof vi.fn>;
  mockRpc: ReturnType<typeof vi.fn>;
  /** 체인 끝에서 반환할 결과를 설정 */
  setResult: (data: unknown, error?: { message: string } | null) => void;
}

export function createMockSupabase(): MockSupabaseChain {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockUpsert = vi.fn();
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockRpc = vi.fn();

  let result = { data: null as unknown, error: null as { message: string } | null };

  const mockReturns = vi.fn();

  const chain = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    upsert: mockUpsert,
    eq: mockEq,
    neq: mockEq,
    in: mockEq,
    gte: mockEq,
    lte: mockEq,
    ilike: mockEq,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    returns: mockReturns,
  };

  // 모든 체이닝 메서드가 chain 자신을 반환
  for (const mock of [mockSelect, mockInsert, mockUpdate, mockDelete, mockUpsert, mockEq, mockOrder, mockLimit, mockReturns]) {
    mock.mockReturnValue(chain);
  }

  // 종결 메서드는 result를 반환
  mockSingle.mockImplementation(() => result);
  mockMaybeSingle.mockImplementation(() => result);

  mockFrom.mockReturnValue(chain);
  mockRpc.mockImplementation(() => result);

  const supabase = {
    from: mockFrom,
    rpc: mockRpc,
  } as unknown as SupabaseClient<Database>;

  return {
    supabase,
    mockFrom, mockSelect, mockInsert, mockUpdate, mockDelete, mockUpsert,
    mockEq, mockSingle, mockMaybeSingle, mockOrder, mockLimit, mockRpc,
    setResult: (data, error = null) => { result = { data, error }; },
  };
}

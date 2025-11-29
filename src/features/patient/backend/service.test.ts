import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchPatients,
  createAttendance,
  checkAttendance,
  createVitals,
} from './service';
import { PatientError, PatientErrorCode } from './error';
import type {
  SearchQueryParams,
  CreateAttendanceRequest,
  CheckAttendanceParams,
  CreateVitalsRequest,
} from './schema';

// Supabase 모킹 헬퍼
const createMockSupabaseBuilder = () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockIlike = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockSingle = vi.fn();
  const mockInsert = vi.fn();
  const mockUpsert = vi.fn();

  const supabase = {
    from: mockFrom,
  } as any;

  // 체이닝 패턴 설정
  const selectChain = { eq: mockEq, single: mockSingle };
  const insertChain = { select: vi.fn().mockReturnValue(selectChain) };
  const upsertChain = { select: vi.fn().mockReturnValue(selectChain) };
  const eqChain = { eq: mockEq, ilike: mockIlike, order: mockOrder, single: mockSingle };
  const ilikeChain = { order: mockOrder };
  const orderChain = { limit: mockLimit, single: mockSingle };

  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert, upsert: mockUpsert });
  mockSelect.mockReturnValue(selectChain);
  mockInsert.mockReturnValue(insertChain);
  mockUpsert.mockReturnValue(upsertChain);
  mockEq.mockReturnValue(eqChain);
  mockIlike.mockReturnValue(ilikeChain);
  mockOrder.mockReturnValue(orderChain);
  mockLimit.mockReturnValue({ data: null, error: null });
  mockSingle.mockReturnValue({ data: null, error: null });

  return {
    supabase,
    mockFrom,
    mockSelect,
    mockEq,
    mockIlike,
    mockOrder,
    mockLimit,
    mockSingle,
    mockInsert,
    mockUpsert,
  };
};

describe('patient/backend/service', () => {
  describe('searchPatients', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseBuilder>;

    beforeEach(() => {
      mockSupabase = createMockSupabaseBuilder();
    });

    it('환자 이름으로 검색한다', async () => {
      const params: SearchQueryParams = { q: '홍' };

      const mockPatients = [
        { id: 'patient-1', name: '홍길동' },
        { id: 'patient-2', name: '홍진호' },
      ];

      mockSupabase.mockLimit.mockResolvedValue({
        data: mockPatients,
        error: null,
      });

      const result = await searchPatients(mockSupabase.supabase, params);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('홍길동');
      expect(result[1].name).toBe('홍진호');

      expect(mockSupabase.mockFrom).toHaveBeenCalledWith('patients');
      expect(mockSupabase.mockEq).toHaveBeenCalledWith('status', 'active');
      expect(mockSupabase.mockIlike).toHaveBeenCalledWith('name', '홍%');
    });

    it('검색 결과가 없으면 빈 배열을 반환한다', async () => {
      const params: SearchQueryParams = { q: '존재하지않는이름' };

      mockSupabase.mockLimit.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await searchPatients(mockSupabase.supabase, params);

      expect(result).toEqual([]);
    });

    it('데이터베이스 에러 시 PatientError를 던진다', async () => {
      const params: SearchQueryParams = { q: '홍' };

      mockSupabase.mockLimit.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(searchPatients(mockSupabase.supabase, params)).rejects.toThrow(PatientError);

      try {
        await searchPatients(mockSupabase.supabase, params);
      } catch (error) {
        expect((error as PatientError).code).toBe(PatientErrorCode.INVALID_SEARCH_QUERY);
      }
    });

    it('최대 10개의 결과만 반환한다', async () => {
      const params: SearchQueryParams = { q: '김' };

      const mockPatients = Array.from({ length: 15 }, (_, i) => ({
        id: `patient-${i}`,
        name: `김철수${i}`,
      }));

      mockSupabase.mockLimit.mockResolvedValue({
        data: mockPatients.slice(0, 10),
        error: null,
      });

      const result = await searchPatients(mockSupabase.supabase, params);

      expect(mockSupabase.mockLimit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(10);
    });
  });

  describe('createAttendance', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseBuilder>;

    beforeEach(() => {
      mockSupabase = createMockSupabaseBuilder();
    });

    it('출석 기록을 생성한다', async () => {
      const request: CreateAttendanceRequest = {
        patient_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-15',
      };

      // 기존 출석 기록 없음
      mockSupabase.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // No rows found
      });

      const mockAttendance = {
        id: 'attendance-1',
        patient_id: request.patient_id,
        date: request.date,
        checked_at: '2025-01-15T09:00:00Z',
      };

      mockSupabase.mockSingle.mockResolvedValueOnce({
        data: mockAttendance,
        error: null,
      });

      const result = await createAttendance(mockSupabase.supabase, request);

      expect(result.id).toBe('attendance-1');
      expect(result.patient_id).toBe(request.patient_id);
      expect(result.date).toBe(request.date);

      expect(mockSupabase.mockInsert).toHaveBeenCalled();
    });

    it('이미 출석한 경우 ALREADY_ATTENDED 에러를 던진다', async () => {
      const request: CreateAttendanceRequest = {
        patient_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-15',
      };

      // 이미 출석 기록 있음
      mockSupabase.mockSingle.mockResolvedValue({
        data: { id: 'existing-attendance' },
        error: null,
      });

      await expect(createAttendance(mockSupabase.supabase, request)).rejects.toThrow(
        PatientError
      );

      try {
        await createAttendance(mockSupabase.supabase, request);
      } catch (error) {
        expect((error as PatientError).code).toBe(PatientErrorCode.ALREADY_ATTENDED);
        expect((error as PatientError).message).toContain('이미 출석하셨습니다');
      }
    });

    it('출석 저장 실패 시 ATTENDANCE_SAVE_FAILED 에러를 던진다', async () => {
      const request: CreateAttendanceRequest = {
        patient_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-15',
      };

      mockSupabase.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockSupabase.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(createAttendance(mockSupabase.supabase, request)).rejects.toThrow(
        PatientError
      );

      try {
        await createAttendance(mockSupabase.supabase, request);
      } catch (error) {
        expect((error as PatientError).code).toBe(PatientErrorCode.ATTENDANCE_SAVE_FAILED);
      }
    });
  });

  describe('checkAttendance', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseBuilder>;

    beforeEach(() => {
      mockSupabase = createMockSupabaseBuilder();
    });

    it('출석한 경우 is_attended: true를 반환한다', async () => {
      const params: CheckAttendanceParams = {
        patient_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-15',
      };

      mockSupabase.mockSingle.mockResolvedValue({
        data: { id: 'attendance-1' },
        error: null,
      });

      const result = await checkAttendance(mockSupabase.supabase, params);

      expect(result.is_attended).toBe(true);
    });

    it('출석하지 않은 경우 is_attended: false를 반환한다', async () => {
      const params: CheckAttendanceParams = {
        patient_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-15',
      };

      mockSupabase.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // No rows found
      });

      const result = await checkAttendance(mockSupabase.supabase, params);

      expect(result.is_attended).toBe(false);
    });

    it('데이터베이스 에러 시 (PGRST116 제외) 에러를 던진다', async () => {
      const params: CheckAttendanceParams = {
        patient_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-15',
      };

      mockSupabase.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST000', message: 'Database error' },
      });

      await expect(checkAttendance(mockSupabase.supabase, params)).rejects.toThrow();
    });
  });

  describe('createVitals', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseBuilder>;

    beforeEach(() => {
      mockSupabase = createMockSupabaseBuilder();
    });

    it('활력징후 기록을 생성한다', async () => {
      const request: CreateVitalsRequest = {
        patient_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-15',
        systolic: 120,
        diastolic: 80,
        blood_sugar: 100,
        memo: '정상 범위',
      };

      const mockVitals = {
        id: 'vitals-1',
        patient_id: request.patient_id,
        date: request.date,
        systolic: 120,
        diastolic: 80,
        blood_sugar: 100,
        memo: '정상 범위',
        recorded_at: '2025-01-15T09:00:00Z',
      };

      mockSupabase.mockSingle.mockResolvedValue({
        data: mockVitals,
        error: null,
      });

      const result = await createVitals(mockSupabase.supabase, request);

      expect(result.id).toBe('vitals-1');
      expect(result.systolic).toBe(120);
      expect(result.diastolic).toBe(80);
      expect(result.blood_sugar).toBe(100);
      expect(result.memo).toBe('정상 범위');

      expect(mockSupabase.mockUpsert).toHaveBeenCalled();
    });

    it('부분적인 활력징후 데이터를 저장한다 (일부 필드만)', async () => {
      const request: CreateVitalsRequest = {
        patient_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-15',
        systolic: 120,
        diastolic: 80,
        // blood_sugar, memo 없음
      };

      const mockVitals = {
        id: 'vitals-1',
        patient_id: request.patient_id,
        date: request.date,
        systolic: 120,
        diastolic: 80,
        blood_sugar: null,
        memo: null,
        recorded_at: '2025-01-15T09:00:00Z',
      };

      mockSupabase.mockSingle.mockResolvedValue({
        data: mockVitals,
        error: null,
      });

      const result = await createVitals(mockSupabase.supabase, request);

      expect(result.systolic).toBe(120);
      expect(result.diastolic).toBe(80);
      expect(result.blood_sugar).toBeNull();
      expect(result.memo).toBeNull();
    });

    it('활력징후 저장 실패 시 VITALS_SAVE_FAILED 에러를 던진다', async () => {
      const request: CreateVitalsRequest = {
        patient_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2025-01-15',
        systolic: 120,
        diastolic: 80,
      };

      mockSupabase.mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Upsert failed' },
      });

      await expect(createVitals(mockSupabase.supabase, request)).rejects.toThrow(PatientError);

      try {
        await createVitals(mockSupabase.supabase, request);
      } catch (error) {
        expect((error as PatientError).code).toBe(PatientErrorCode.VITALS_SAVE_FAILED);
      }
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClinicalHistoryByPatientIdNo } from './clinical-history';

const config = {
  apiUrl: 'https://clinical.example.com',
  apiKey: 'test-key',
};

describe('getClinicalHistoryByPatientIdNo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('병록번호로 현재 개인력 버전을 조회해 화면용 필드로 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        summary_text: '한줄 요약',
        onset_text: '초발 내용',
        course_text: '경과 내용',
        current_text: '현재 내용',
        full_markdown: '전체 개인력',
        source_generated_at: '2026-08-31T12:00:00Z',
        source_captured_at: '2026-08-31T11:00:00Z',
      },
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getClinicalHistoryByPatientIdNo(config, '00123');

    expect(result.status).toBe('available');
    expect(result.history?.summary_text).toBe('한줄 요약');
    expect(result.history?.updated_at).toBe('2026-08-31T12:00:00Z');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('patient_id_no=eq.00123');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('is_current=eq.true');
  });

  it('원문 병록번호에 결과가 없으면 선행 0을 제거한 번호로 한 번 더 조회한다', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        summary_text: '요약',
        onset_text: '',
        course_text: '',
        current_text: '',
        full_markdown: '전체',
        source_generated_at: null,
        source_captured_at: '2026-08-30T10:00:00Z',
      }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getClinicalHistoryByPatientIdNo(config, '00123');

    expect(result.status).toBe('available');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('patient_id_no=eq.123');
  });

  it('등록된 개인력이 없으면 not_found를 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));

    await expect(getClinicalHistoryByPatientIdNo(config, '123')).resolves.toEqual({
      status: 'not_found',
      history: null,
    });
  });

  it('연결 오류가 나면 환자 히스토리 전체를 깨지 않고 unavailable을 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('gateway error', { status: 502 })));

    await expect(getClinicalHistoryByPatientIdNo(config, '123')).resolves.toEqual({
      status: 'unavailable',
      history: null,
    });
  });
});

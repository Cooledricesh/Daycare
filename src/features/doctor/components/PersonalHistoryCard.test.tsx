import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PersonalHistoryCard } from './PersonalHistoryCard';

const history = {
  summary_text: '가족 갈등 이후 증상이 시작되어 치료를 이어오고 있음.',
  onset_text: '초발 당시 내용',
  course_text: '치료 경과 내용',
  current_text: '현재 상태 내용',
  full_markdown: '전체 개인력 원문',
  updated_at: '2026-08-31T12:00:00Z',
};

describe('PersonalHistoryCard', () => {
  it('한줄 요약과 개인력 세부 항목을 표시한다', () => {
    render(<PersonalHistoryCard status="available" history={history} />);

    expect(screen.getByText('개인력 요약')).toBeInTheDocument();
    expect(screen.getByText(history.summary_text)).toBeInTheDocument();
    expect(screen.getByText('초발')).toBeInTheDocument();
    expect(screen.getByText('주요 경과')).toBeInTheDocument();
    expect(screen.getByText('현재 상태')).toBeInTheDocument();
  });

  it('개인력이 없으면 안내 문구를 표시한다', () => {
    render(<PersonalHistoryCard status="not_found" history={null} />);

    expect(screen.getByText('등록된 개인력 요약이 없습니다.')).toBeInTheDocument();
  });

  it('조회 연결에 실패하면 별도 안내 문구를 표시한다', () => {
    render(<PersonalHistoryCard status="unavailable" history={null} />);

    expect(screen.getByText('개인력 요약을 불러올 수 없습니다.')).toBeInTheDocument();
  });
});

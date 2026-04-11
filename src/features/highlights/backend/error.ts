export enum HighlightsErrorCode {
  FETCH_FAILED = 'HIGHLIGHTS_FETCH_FAILED',
}

export class HighlightsError extends Error {
  constructor(
    public code: HighlightsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HighlightsError';
  }
}

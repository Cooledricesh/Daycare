export const MonthlyReportErrorCodes = {
  INVALID_PERIOD: 'monthly_report/invalid_period',
  GENERATION_FAILED: 'monthly_report/generation_failed',
  NOT_FOUND: 'monthly_report/not_found',
  UNAUTHORIZED: 'monthly_report/unauthorized',
  ACTION_ITEMS_TOO_LONG: 'monthly_report/action_items_too_long',
} as const;

export type MonthlyReportErrorCode =
  (typeof MonthlyReportErrorCodes)[keyof typeof MonthlyReportErrorCodes];

export class MonthlyReportError extends Error {
  constructor(
    public code: MonthlyReportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MonthlyReportError';
  }
}

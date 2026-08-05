export const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';
export const AUTH_SESSION_DURATION_SECONDS = 24 * 60 * 60;
export const AUTH_SESSION_REFRESH_THRESHOLD_SECONDS = 6 * 60 * 60;
export const AUTH_SESSION_ABSOLUTE_DURATION_SECONDS = 7 * 24 * 60 * 60;

export function shouldRefreshAuthSession(
  expiresAt: number | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
  sessionStartedAt?: number,
): boolean {
  if (!expiresAt || expiresAt <= nowSeconds) return false;
  if (
    sessionStartedAt &&
    nowSeconds - sessionStartedAt >= AUTH_SESSION_ABSOLUTE_DURATION_SECONDS
  ) {
    return false;
  }
  return expiresAt - nowSeconds <= AUTH_SESSION_REFRESH_THRESHOLD_SECONDS;
}

export function getAuthSessionRefreshDurationSeconds(
  sessionStartedAt: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): number {
  const absoluteRemaining =
    AUTH_SESSION_ABSOLUTE_DURATION_SECONDS - (nowSeconds - sessionStartedAt);
  return Math.max(0, Math.min(AUTH_SESSION_DURATION_SECONDS, absoluteRemaining));
}
import { createMiddleware } from 'hono/factory';
import {
  contextKeys,
  type AppEnv,
  type AppLogger,
} from '@/server/hono/context';

/** 이 시간(ms)을 넘는 요청은 warn 레벨로 기록한다 */
const SLOW_REQUEST_THRESHOLD_MS = 1000;

/**
 * API 요청별 소요시간 로깅 미들웨어.
 * 성능 리팩토링 전/후 비교를 위한 baseline 측정 용도.
 */
export const withRequestTiming = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const startedAt = performance.now();
    try {
      await next();
    } finally {
      const durationMs = Math.round(performance.now() - startedAt);
      const logger = c.get(contextKeys.logger) as AppLogger | undefined;
      const line = `[timing] ${c.req.method} ${c.req.path} ${c.res?.status ?? '-'} ${durationMs}ms`;

      if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
        logger?.warn?.(line);
      } else {
        logger?.info?.(line);
      }
    }
  });

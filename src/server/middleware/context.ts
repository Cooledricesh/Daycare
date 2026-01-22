import { createMiddleware } from 'hono/factory';
import { getAppConfig } from '@/server/config';
import {
  contextKeys,
  type AppEnv,
  type AppLogger,
} from '@/server/hono/context';

const logger: AppLogger = {
  info: (...args) => console.info(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  debug: (...args) => console.debug(...args),
};

export const withAppContext = () => {
  return createMiddleware<AppEnv>(async (c, next) => {
    const config = getAppConfig();
    c.set(contextKeys.logger, logger);
    c.set(contextKeys.config, config);

    await next();
  });
};

import type { Context } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AppLogger = Pick<Console, 'info' | 'error' | 'warn' | 'debug'>;

export type AppConfig = {
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
};

export type JWTPayload = {
  sub: string; // user.id
  role: string;
  name: string;
  iat?: number;
  exp?: number;
};

export type AppVariables = {
  supabase: SupabaseClient;
  logger: AppLogger;
  config: AppConfig;
  user?: JWTPayload; // JWT 인증 후 주입되는 사용자 정보
};

export type AppEnv = {
  Variables: AppVariables;
};

export type AppContext = Context<AppEnv>;

export const contextKeys = {
  supabase: 'supabase',
  logger: 'logger',
  config: 'config',
  user: 'user',
} as const satisfies Record<keyof AppVariables, keyof AppVariables>;

export const getSupabase = (c: AppContext) =>
  c.get(contextKeys.supabase) as SupabaseClient;

export const getLogger = (c: AppContext) =>
  c.get(contextKeys.logger) as AppLogger;

export const getConfig = (c: AppContext) =>
  c.get(contextKeys.config) as AppConfig;

export const getUser = (c: AppContext) =>
  c.get(contextKeys.user) as JWTPayload | undefined;

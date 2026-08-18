import { z } from 'zod';
import type { AppConfig } from '@/server/hono/context';

const envSchema = z.object({
  DAYCARE_DATA_API_URL: z.string().url(),
  DAYCARE_DATA_API_KEY: z.string().min(1),
  DAYCARE_AVATAR_API_URL: z.string().url(),
  DAYCARE_AVATAR_API_KEY: z.string().min(1),
  CARESCHEDULER_API_URL: z.string().url(),
  CARESCHEDULER_API_KEY: z.string().min(1),
});

let cachedConfig: AppConfig | null = null;

export const getAppConfig = (): AppConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const dataApiUrl = process.env.DAYCARE_DATA_API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dataApiKey = process.env.DAYCARE_DATA_API_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const avatarApiUrl = process.env.DAYCARE_AVATAR_API_URL ?? dataApiUrl;
  const avatarApiKey = process.env.DAYCARE_AVATAR_API_KEY ?? dataApiKey;

  const parsed = envSchema.safeParse({
    DAYCARE_DATA_API_URL: dataApiUrl,
    DAYCARE_DATA_API_KEY: dataApiKey,
    DAYCARE_AVATAR_API_URL: avatarApiUrl,
    DAYCARE_AVATAR_API_KEY: avatarApiKey,
    CARESCHEDULER_API_URL: process.env.CARESCHEDULER_API_URL,
    CARESCHEDULER_API_KEY: process.env.CARESCHEDULER_API_KEY,
  });

  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid backend configuration: ${messages}`);
  }

  cachedConfig = {
    supabase: {
      url: parsed.data.DAYCARE_DATA_API_URL,
      serviceRoleKey: parsed.data.DAYCARE_DATA_API_KEY,
    },
    avatarStorage: {
      url: parsed.data.DAYCARE_AVATAR_API_URL,
      apiKey: parsed.data.DAYCARE_AVATAR_API_KEY,
    },
    carescheduler: {
      apiUrl: parsed.data.CARESCHEDULER_API_URL,
      apiKey: parsed.data.CARESCHEDULER_API_KEY,
    },
  } satisfies AppConfig;

  return cachedConfig;
};

import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { dismissSyncNotificationSchema } from './schema';
import { getSyncNotifications, dismissSyncNotification } from './service';

const notificationRoutes = new Hono<AppEnv>();

/**
 * GET /api/shared/notifications/sync
 * 미확인 동기화 알림 조회
 */
notificationRoutes.get('/sync', async (c) => {
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const supabase = c.get('supabase');
  const result = await getSyncNotifications(supabase, user.sub);
  return respond(c, success(result, 200));
});

/**
 * POST /api/shared/notifications/sync/dismiss
 * 동기화 알림 확인(닫기)
 */
notificationRoutes.post('/sync/dismiss', async (c) => {
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const body = await c.req.json();
  const parseResult = dismissSyncNotificationSchema.safeParse(body);

  if (!parseResult.success) {
    return respond(c, failure(400, 'INVALID_REQUEST', parseResult.error.issues[0]?.message || '잘못된 요청입니다'));
  }

  const supabase = c.get('supabase');
  await dismissSyncNotification(supabase, user.sub, parseResult.data.sync_log_id);
  return respond(c, success({ dismissed: true }, 200));
});

export default notificationRoutes;

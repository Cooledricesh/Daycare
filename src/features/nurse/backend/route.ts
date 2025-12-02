import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { NurseError } from './error';
import {
  getPrescriptionsSchema,
  completeTaskSchema,
  createMessageSchema,
} from './schema';
import { getPrescriptions, completeTask, createMessage } from './service';

const nurseRoutes = new Hono<AppEnv>();

/**
 * GET /api/nurse/prescriptions
 * 처방 변경 목록 조회
 */
nurseRoutes.get('/prescriptions', async (c) => {
  const supabase = c.get('supabase');
  const date = c.req.query('date');
  const filter = c.req.query('filter');

  try {
    const params = getPrescriptionsSchema.parse({ date, filter });
    const prescriptions = await getPrescriptions(supabase, params);

    return respond(c, success({ prescriptions }, 200));
  } catch (error) {
    if (error instanceof NurseError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/nurse/task/:consultation_id/complete
 * 지시사항 처리 완료
 */
nurseRoutes.post('/task/:consultation_id/complete', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const consultation_id = c.req.param('consultation_id');
  const body = await c.req.json();

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const staffId = user.sub;

  try {
    const params = completeTaskSchema.parse({ consultation_id, ...body });
    const taskCompletion = await completeTask(supabase, staffId, params);

    return respond(c, success({ task_completion: taskCompletion }, 200));
  } catch (error) {
    if (error instanceof NurseError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/nurse/messages
 * 전달사항 작성
 */
nurseRoutes.post('/messages', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json();

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const staffId = user.sub;

  try {
    const params = createMessageSchema.parse(body);
    const message = await createMessage(supabase, staffId, params);

    return respond(c, success({ message }, 201));
  } catch (error) {
    if (error instanceof NurseError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

export default nurseRoutes;

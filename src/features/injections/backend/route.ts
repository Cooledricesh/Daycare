import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { getPatientInjections, getUpcomingInjections } from './service';
import { InjectionsError, InjectionsErrorCode } from './error';

const patientIdSchema = z.string().uuid('환자 ID는 UUID 형식이어야 합니다.');
const daysSchema = z.coerce.number().int().min(1).max(60).optional();

const injectionsRoutes = new Hono<AppEnv>();

injectionsRoutes.get('/upcoming', async (c) => {
  const supabase = c.get('supabase');

  const parsed = daysSchema.safeParse(c.req.query('days'));
  if (!parsed.success) {
    return respond(
      c,
      failure(
        400,
        InjectionsErrorCode.INVALID_REQUEST,
        parsed.error.issues[0]?.message ?? '잘못된 요청입니다.',
      ),
    );
  }

  try {
    const result = await getUpcomingInjections(supabase, { days: parsed.data });
    return respond(c, success(result, 200));
  } catch (err) {
    if (err instanceof InjectionsError) {
      return respond(c, failure(400, err.code, err.message));
    }
    throw err;
  }
});

injectionsRoutes.get('/patient/:patientId', async (c) => {
  const supabase = c.get('supabase');

  const parsed = patientIdSchema.safeParse(c.req.param('patientId'));
  if (!parsed.success) {
    return respond(
      c,
      failure(400, InjectionsErrorCode.INVALID_REQUEST, parsed.error.issues[0]?.message ?? '잘못된 요청입니다.'),
    );
  }

  try {
    const result = await getPatientInjections(supabase, parsed.data);
    return respond(c, success(result, 200));
  } catch (err) {
    if (err instanceof InjectionsError) {
      const status = err.code === InjectionsErrorCode.PATIENT_NOT_FOUND ? 404 : 400;
      return respond(c, failure(status, err.code, err.message));
    }
    throw err;
  }
});

export default injectionsRoutes;

import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { getAbsenceOverviewQuerySchema, getAbsenceDetailQuerySchema } from './schema';
import { getAbsenceOverview, getAbsenceDetail } from './service';
import { AbsenceRiskError, AbsenceRiskErrorCode } from './error';

const absenceRiskRoutes = new Hono<AppEnv>();

/**
 * GET /api/shared/absence-risk/overview
 * 결석 위험 환자 목록
 */
absenceRiskRoutes.get('/overview', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const query = c.req.query();
  const parseResult = getAbsenceOverviewQuerySchema.safeParse({
    period: query.period,
    coordinator_id: query.coordinator_id,
  });

  if (!parseResult.success) {
    return respond(c, failure(400, 'INVALID_REQUEST', parseResult.error.issues[0]?.message || '잘못된 요청입니다'));
  }

  const params = parseResult.data;
  if (user.role === 'coordinator') {
    params.coordinator_id = user.sub;
  }

  try {
    const overview = await getAbsenceOverview(supabase, params);
    return respond(c, success(overview, 200));
  } catch (error) {
    if (error instanceof AbsenceRiskError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/shared/absence-risk/:patientId
 * 개별 환자 결석 상세
 */
absenceRiskRoutes.get('/:patientId', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const patientId = c.req.param('patientId');
  const query = c.req.query();
  const parseResult = getAbsenceDetailQuerySchema.safeParse({ period: query.period });

  if (!parseResult.success) {
    return respond(c, failure(400, 'INVALID_REQUEST', parseResult.error.issues[0]?.message || '잘못된 요청입니다'));
  }

  try {
    const detail = await getAbsenceDetail(supabase, patientId, parseResult.data);
    return respond(c, success(detail, 200));
  } catch (error) {
    if (error instanceof AbsenceRiskError) {
      const status = error.code === AbsenceRiskErrorCode.PATIENT_NOT_FOUND ? 404 : 400;
      return respond(c, failure(status, error.code, error.message));
    }
    throw error;
  }
});

export default absenceRiskRoutes;

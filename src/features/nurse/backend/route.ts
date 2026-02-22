import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { NurseError } from './error';
import {
  getNursePatientsSchema,
  getPrescriptionsSchema,
  completeTaskSchema,
  createMessageSchema,
} from './schema';
import { getNursePatients, getPrescriptions, completeTask, createMessage } from './service';
import { getPatientDetail } from '@/features/staff/backend/service';
import { StaffError } from '@/features/staff/backend/error';
import { getPatientHistory } from '@/features/doctor/backend/service';
import { getPatientDetailSchema } from '@/features/staff/backend/schema';

const nurseRoutes = new Hono<AppEnv>();

/**
 * GET /api/nurse/patients
 * 전체 환자 목록 조회 (간호사용)
 */
nurseRoutes.get('/patients', async (c) => {
  const supabase = c.get('supabase');
  const date = c.req.query('date');
  const filter = c.req.query('filter');

  try {
    const params = getNursePatientsSchema.parse({ date, filter });
    const patients = await getNursePatients(supabase, params);

    return respond(c, success({ patients }, 200));
  } catch (error) {
    if (error instanceof NurseError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/nurse/patient/:id
 * 환자 상세 조회
 */
nurseRoutes.get('/patient/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const patient_id = c.req.param('id');
  const date = c.req.query('date');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  try {
    const params = getPatientDetailSchema.parse({ patient_id, date });
    const patient = await getPatientDetail(supabase, user.sub, user.role, params);

    return respond(c, success({ patient }, 200));
  } catch (error) {
    if (error instanceof StaffError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/nurse/patient/:id/history
 * 환자 히스토리 조회
 */
nurseRoutes.get('/patient/:id/history', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const patient_id = c.req.param('id');
  const months = parseInt(c.req.query('months') || '24', 10);

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  try {
    const history = await getPatientHistory(supabase, {
      patient_id,
      months: Math.min(Math.max(months, 0), 24),
    });
    return respond(c, success(history, 200));
  } catch (error) {
    return respond(c, failure(400, 'HISTORY_FETCH_FAILED', '히스토리를 불러올 수 없습니다'));
  }
});

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

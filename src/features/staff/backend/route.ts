import { Hono } from 'hono';
import type { AppEnv } from '@/backend/hono/context';
import { success, failure, respond } from '@/backend/http/response';
import { StaffError } from './error';
import {
  getMyPatientsSchema,
  getPatientDetailSchema,
  completeTaskSchema,
  createMessageSchema,
} from './schema';
import {
  getMyPatients,
  getPatientDetail,
  completeTask,
  createMessage,
} from './service';

const staffRoutes = new Hono<AppEnv>();

/**
 * GET /api/staff/my-patients
 * 담당 환자 목록 조회
 */
staffRoutes.get('/my-patients', async (c) => {
  const supabase = c.get('supabase');
  const date = c.req.query('date');

  // TODO: JWT에서 staffId 추출 (현재는 임시로 하드코딩)
  // const staffId = c.get('staffId');
  const staffId = '00000000-0000-0000-0000-000000000000';

  try {
    const params = getMyPatientsSchema.parse({ date });
    const patients = await getMyPatients(supabase, staffId, params);

    return respond(c, success({ patients }, 200));
  } catch (error) {
    if (error instanceof StaffError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/staff/patient/:id
 * 환자 상세 조회
 */
staffRoutes.get('/patient/:id', async (c) => {
  const supabase = c.get('supabase');
  const patient_id = c.req.param('id');
  const date = c.req.query('date');

  // TODO: JWT에서 staffId 추출
  const staffId = '00000000-0000-0000-0000-000000000000';

  try {
    const params = getPatientDetailSchema.parse({ patient_id, date });
    const patient = await getPatientDetail(supabase, staffId, params);

    return respond(c, success({ patient }, 200));
  } catch (error) {
    if (error instanceof StaffError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/staff/task/:consultation_id/complete
 * 지시사항 처리 완료
 */
staffRoutes.post('/task/:consultation_id/complete', async (c) => {
  const supabase = c.get('supabase');
  const consultation_id = c.req.param('consultation_id');
  const body = await c.req.json();

  // TODO: JWT에서 staffId 추출
  const staffId = '00000000-0000-0000-0000-000000000000';

  try {
    const params = completeTaskSchema.parse({ consultation_id, ...body });
    const taskCompletion = await completeTask(supabase, staffId, params);

    return respond(c, success({ task_completion: taskCompletion }, 200));
  } catch (error) {
    if (error instanceof StaffError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/staff/messages
 * 전달사항 작성
 */
staffRoutes.post('/messages', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  // TODO: JWT에서 staffId 추출
  const staffId = '00000000-0000-0000-0000-000000000000';

  try {
    const params = createMessageSchema.parse(body);
    const message = await createMessage(supabase, staffId, params);

    return respond(c, success({ message }, 201));
  } catch (error) {
    if (error instanceof StaffError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

export default staffRoutes;

import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { StaffError } from './error';
import {
  getMyPatientsSchema,
  getPatientDetailSchema,
  completeTaskSchema,
  createMessageSchema,
  updateSchedulePatternSchema,
  getMessagesSchema,
} from './schema';
import {
  getMyPatients,
  getPatientDetail,
  completeTask,
  createMessage,
  getMyPatientsSchedulePatterns,
  updateMyPatientSchedulePattern,
  getMyMessages,
} from './service';
import { getPatientHistory } from '@/features/doctor/backend/service';

const staffRoutes = new Hono<AppEnv>();

/**
 * GET /api/staff/my-patients
 * 담당 환자 목록 조회
 */
staffRoutes.get('/my-patients', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const date = c.req.query('date');
  const show_all = c.req.query('show_all');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const staffId = user.sub; // JWT의 sub 필드에서 사용자 ID 추출

  try {
    const params = getMyPatientsSchema.parse({ date, show_all });
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
  const user = c.get('user');
  const patient_id = c.req.param('id');
  const date = c.req.query('date');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const staffId = user.sub;
  const userRole = user.role;

  try {
    const params = getPatientDetailSchema.parse({ patient_id, date });
    const patient = await getPatientDetail(supabase, staffId, userRole, params);

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
    if (error instanceof StaffError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/staff/messages
 * 담당 환자 전달사항 목록 조회
 */
staffRoutes.get('/messages', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const date = c.req.query('date');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const staffId = user.sub;

  try {
    const params = getMessagesSchema.parse({ date });
    const messages = await getMyMessages(supabase, staffId, params);
    return respond(c, success({ messages }, 200));
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
    if (error instanceof StaffError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/staff/patient/:id/history
 * 환자 진찰 히스토리 조회 (코디용)
 */
staffRoutes.get('/patient/:id/history', async (c) => {
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
 * GET /api/staff/schedule-patterns
 * 담당 환자 출석 패턴 목록 조회
 */
staffRoutes.get('/schedule-patterns', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const staffId = user.sub;

  try {
    const patterns = await getMyPatientsSchedulePatterns(supabase, staffId);
    return respond(c, success({ patterns }, 200));
  } catch (error) {
    if (error instanceof StaffError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * PUT /api/staff/schedule-patterns/:patient_id
 * 담당 환자 출석 패턴 수정
 */
staffRoutes.put('/schedule-patterns/:patient_id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const patientId = c.req.param('patient_id');
  const body = await c.req.json();

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const staffId = user.sub;

  try {
    const params = updateSchedulePatternSchema.parse(body);
    const result = await updateMyPatientSchedulePattern(supabase, staffId, patientId, params);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof StaffError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

export default staffRoutes;

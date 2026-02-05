import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { DoctorError, DoctorErrorCode } from './error';
import {
  GetTasksParamsSchema,
  GetPatientHistoryParamsSchema,
  MarkMessageReadRequestSchema,
  GetWaitingPatientsParamsSchema,
  CreateConsultationRequestSchema,
  GetPatientMessagesParamsSchema,
} from './schema';
import {
  getTasks,
  getPatientHistory,
  getTodayMessages,
  markMessageRead,
  getWaitingPatients,
  createConsultation,
  getPatientMessages,
} from './service';

const doctorRoutes = new Hono<AppEnv>();

/**
 * GET /api/doctor/tasks
 * 오늘 지시사항 목록 조회
 */
doctorRoutes.get('/tasks', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const query = c.req.query();
  const parseResult = GetTasksParamsSchema.safeParse({
    date: query.date,
    status: query.status,
  });

  if (!parseResult.success) {
    return respond(
      c,
      failure(400, DoctorErrorCode.INVALID_REQUEST, parseResult.error.message),
    );
  }

  try {
    const tasks = await getTasks(supabase, user.sub, parseResult.data);
    return respond(c, success(tasks, 200));
  } catch (error) {
    if (error instanceof DoctorError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/doctor/history/:patientId
 * 환자별 히스토리 조회
 */
doctorRoutes.get('/history/:patientId', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const patientId = c.req.param('patientId');
  const query = c.req.query();

  const parseResult = GetPatientHistoryParamsSchema.safeParse({
    patient_id: patientId,
    months: query.months ? parseInt(query.months, 10) : undefined,
  });

  if (!parseResult.success) {
    return respond(
      c,
      failure(400, DoctorErrorCode.INVALID_REQUEST, parseResult.error.message),
    );
  }

  try {
    const history = await getPatientHistory(supabase, parseResult.data);
    return respond(c, success(history, 200));
  } catch (error) {
    if (error instanceof DoctorError) {
      const status = error.code === DoctorErrorCode.PATIENT_NOT_FOUND ? 404 : 400;
      return respond(c, failure(status, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/doctor/messages
 * 오늘 전달사항 목록 조회
 */
doctorRoutes.get('/messages', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const query = c.req.query();

  try {
    const messages = await getTodayMessages(supabase, query.date);
    return respond(c, success(messages, 200));
  } catch (error) {
    if (error instanceof DoctorError) {
      return respond(c, failure(500, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/doctor/messages/:messageId/read
 * 메시지 읽음 처리
 */
doctorRoutes.post('/messages/:messageId/read', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const messageId = c.req.param('messageId');
  const parseResult = MarkMessageReadRequestSchema.safeParse({
    message_id: messageId,
  });

  if (!parseResult.success) {
    return respond(
      c,
      failure(400, DoctorErrorCode.INVALID_REQUEST, parseResult.error.message),
    );
  }

  try {
    const result = await markMessageRead(supabase, parseResult.data);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof DoctorError) {
      const status = error.code === DoctorErrorCode.MESSAGE_NOT_FOUND ? 404 : 400;
      return respond(c, failure(status, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/doctor/waiting-patients
 * 대기 환자 목록 조회
 */
doctorRoutes.get('/waiting-patients', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const query = c.req.query();
  const parseResult = GetWaitingPatientsParamsSchema.safeParse({
    date: query.date,
  });

  if (!parseResult.success) {
    return respond(
      c,
      failure(400, DoctorErrorCode.INVALID_REQUEST, parseResult.error.message),
    );
  }

  try {
    const patients = await getWaitingPatients(supabase, parseResult.data);
    return respond(c, success(patients, 200));
  } catch (error) {
    if (error instanceof DoctorError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/doctor/consultations
 * 진찰 기록 생성
 */
doctorRoutes.post('/consultations', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const body = await c.req.json();
  const parseResult = CreateConsultationRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return respond(
      c,
      failure(400, DoctorErrorCode.INVALID_REQUEST, parseResult.error.message),
    );
  }

  try {
    const consultation = await createConsultation(supabase, user.sub, parseResult.data);
    return respond(c, success(consultation, 201));
  } catch (error) {
    if (error instanceof DoctorError) {
      const status = error.code === DoctorErrorCode.PATIENT_NOT_FOUND ? 404 : 400;
      return respond(c, failure(status, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/doctor/patients/:patientId/messages
 * 환자별 전달사항 조회
 */
doctorRoutes.get('/patients/:patientId/messages', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const patientId = c.req.param('patientId');
  const query = c.req.query();

  const parseResult = GetPatientMessagesParamsSchema.safeParse({
    patient_id: patientId,
    date: query.date,
  });

  if (!parseResult.success) {
    return respond(
      c,
      failure(400, DoctorErrorCode.INVALID_REQUEST, parseResult.error.message),
    );
  }

  try {
    const messages = await getPatientMessages(supabase, parseResult.data);
    return respond(c, success(messages, 200));
  } catch (error) {
    if (error instanceof DoctorError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

export default doctorRoutes;

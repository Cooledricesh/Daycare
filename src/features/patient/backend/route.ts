import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { PatientError, PatientErrorCode } from './error';
import {
  searchQuerySchema,
  createAttendanceSchema,
  checkAttendanceSchema,
  createVitalsSchema,
} from './schema';
import {
  searchPatients,
  createAttendance,
  checkAttendance,
  createVitals,
} from './service';

const patientRoutes = new Hono<AppEnv>();

/**
 * GET /api/patients/search
 * 환자 검색 (이름 기반 자동완성)
 */
patientRoutes.get('/search', async (c) => {
  const supabase = c.get('supabase');
  const query = c.req.query('q');

  try {
    const params = searchQuerySchema.parse({ q: query });
    const patients = await searchPatients(supabase, params);

    return respond(c, success({ patients }, 200));
  } catch (error) {
    if (error instanceof PatientError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/attendances
 * 출석 기록 생성
 */
patientRoutes.post('/attendances', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  try {
    const request = createAttendanceSchema.parse(body);
    const attendance = await createAttendance(supabase, request);

    return respond(c, success({ attendance }, 201));
  } catch (error) {
    if (error instanceof PatientError) {
      if (error.code === PatientErrorCode.ALREADY_ATTENDED) {
        return respond(c, failure(409, error.code, error.message));
      }
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/attendances/check
 * 출석 여부 확인
 */
patientRoutes.get('/attendances/check', async (c) => {
  const supabase = c.get('supabase');
  const patient_id = c.req.query('patient_id');
  const date = c.req.query('date');

  try {
    const params = checkAttendanceSchema.parse({ patient_id, date });
    const result = await checkAttendance(supabase, params);

    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof PatientError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/vitals
 * 활력징후 기록 생성/업데이트
 */
patientRoutes.post('/vitals', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  try {
    const request = createVitalsSchema.parse(body);
    const vitals = await createVitals(supabase, request);

    return respond(c, success({ vitals }, 201));
  } catch (error) {
    if (error instanceof PatientError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

export default patientRoutes;

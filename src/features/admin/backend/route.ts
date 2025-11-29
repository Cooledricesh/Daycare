import { Hono } from 'hono';
import type { AppEnv } from '@/backend/hono/context';
import { success, failure, respond } from '@/backend/http/response';
import { AdminError } from './error';
import {
  getPatientsQuerySchema,
  createPatientSchema,
  updatePatientSchema,
  getStaffQuerySchema,
  createStaffSchema,
  updateStaffSchema,
  resetPasswordSchema,
  getSchedulePatternsQuerySchema,
  updateSchedulePatternSchema,
  getDailyScheduleQuerySchema,
  addManualScheduleSchema,
  cancelScheduleSchema,
  getStatsSummaryQuerySchema,
  getDailyStatsQuerySchema,
} from './schema';
import {
  getPatients,
  getPatientDetail,
  createPatient,
  updatePatient,
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  resetStaffPassword,
  getCoordinators,
  getSchedulePatterns,
  updateSchedulePattern,
  getDailySchedule,
  addManualSchedule,
  cancelSchedule,
  deleteSchedule,
  getStatsSummary,
  getDailyStats,
} from './service';

const adminRoutes = new Hono<AppEnv>();

// ========== Patients Routes ==========

/**
 * GET /api/admin/patients
 * 환자 목록 조회 (페이지네이션, 검색, 필터)
 */
adminRoutes.get('/patients', async (c) => {
  const supabase = c.get('supabase');
  const query = {
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    search: c.req.query('search'),
    status: c.req.query('status'),
    coordinator_id: c.req.query('coordinator_id'),
  };

  try {
    const params = getPatientsQuerySchema.parse(query);
    const result = await getPatients(supabase, params);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/admin/patients/:id
 * 환자 상세 조회
 */
adminRoutes.get('/patients/:id', async (c) => {
  const supabase = c.get('supabase');
  const patientId = c.req.param('id');

  try {
    const result = await getPatientDetail(supabase, patientId);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(404, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/admin/patients
 * 환자 추가
 */
adminRoutes.post('/patients', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  try {
    const request = createPatientSchema.parse(body);
    const result = await createPatient(supabase, request);
    return respond(c, success(result, 201));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * PUT /api/admin/patients/:id
 * 환자 정보 수정
 */
adminRoutes.put('/patients/:id', async (c) => {
  const supabase = c.get('supabase');
  const patientId = c.req.param('id');
  const body = await c.req.json();

  try {
    const request = updatePatientSchema.parse(body);
    const result = await updatePatient(supabase, patientId, request);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

// ========== Staff Routes ==========

/**
 * GET /api/admin/staff
 * 직원 목록 조회
 */
adminRoutes.get('/staff', async (c) => {
  const supabase = c.get('supabase');
  const query = {
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    role: c.req.query('role'),
    status: c.req.query('status'),
  };

  try {
    const params = getStaffQuerySchema.parse(query);
    const result = await getStaff(supabase, params);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/admin/staff/:id
 * 직원 상세 조회
 */
adminRoutes.get('/staff/:id', async (c) => {
  const supabase = c.get('supabase');
  const staffId = c.req.param('id');

  try {
    const result = await getStaffById(supabase, staffId);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(404, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/admin/staff
 * 직원 추가
 */
adminRoutes.post('/staff', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  try {
    const request = createStaffSchema.parse(body);
    const result = await createStaff(supabase, request);
    return respond(c, success(result, 201));
  } catch (error) {
    if (error instanceof AdminError) {
      if (error.code === 'DUPLICATE_LOGIN_ID') {
        return respond(c, failure(409, error.code, error.message));
      }
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * PUT /api/admin/staff/:id
 * 직원 정보 수정
 */
adminRoutes.put('/staff/:id', async (c) => {
  const supabase = c.get('supabase');
  const staffId = c.req.param('id');
  const body = await c.req.json();

  // TODO: 현재 로그인한 사용자 ID 가져오기 (미들웨어에서 주입)
  const currentUserId = 'CURRENT_USER_ID'; // 임시

  try {
    const request = updateStaffSchema.parse(body);
    const result = await updateStaff(supabase, staffId, request, currentUserId);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      if (error.code === 'CANNOT_DEACTIVATE_SELF') {
        return respond(c, failure(403, error.code, error.message));
      }
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/admin/staff/:id/reset-password
 * 비밀번호 초기화
 */
adminRoutes.post('/staff/:id/reset-password', async (c) => {
  const supabase = c.get('supabase');
  const staffId = c.req.param('id');
  const body = await c.req.json();

  try {
    const request = resetPasswordSchema.parse(body);
    const result = await resetStaffPassword(supabase, staffId, request);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/admin/coordinators
 * 코디네이터 목록 조회 (드롭다운용)
 */
adminRoutes.get('/coordinators', async (c) => {
  const supabase = c.get('supabase');

  try {
    const result = await getCoordinators(supabase);
    return respond(c, success({ coordinators: result }, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

// ========== Schedule Routes ==========

/**
 * GET /api/admin/schedule/patterns
 * 환자별 기본 출석 패턴 조회
 */
adminRoutes.get('/schedule/patterns', async (c) => {
  const supabase = c.get('supabase');
  const query = {
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    search: c.req.query('search'),
  };

  try {
    const params = getSchedulePatternsQuerySchema.parse(query);
    const result = await getSchedulePatterns(supabase, params);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * PUT /api/admin/schedule/patterns/:patient_id
 * 환자 출석 패턴 수정
 */
adminRoutes.put('/schedule/patterns/:patient_id', async (c) => {
  const supabase = c.get('supabase');
  const patientId = c.req.param('patient_id');
  const body = await c.req.json();

  try {
    const request = updateSchedulePatternSchema.parse(body);
    const result = await updateSchedulePattern(supabase, patientId, request);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/admin/schedule/daily
 * 일일 예정 출석 조회
 */
adminRoutes.get('/schedule/daily', async (c) => {
  const supabase = c.get('supabase');
  const query = {
    date: c.req.query('date'),
    source: c.req.query('source'),
    status: c.req.query('status'),
  };

  try {
    const params = getDailyScheduleQuerySchema.parse(query);
    const result = await getDailySchedule(supabase, params);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/admin/schedule/daily
 * 수동 예정 출석 추가
 */
adminRoutes.post('/schedule/daily', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  try {
    const request = addManualScheduleSchema.parse(body);
    const result = await addManualSchedule(supabase, request);
    return respond(c, success(result, 201));
  } catch (error) {
    if (error instanceof AdminError) {
      if (error.code === 'SCHEDULE_ALREADY_EXISTS') {
        return respond(c, failure(409, error.code, error.message));
      }
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * PATCH /api/admin/schedule/daily/:id/cancel
 * 예정 출석 취소/복원
 */
adminRoutes.patch('/schedule/daily/:id/cancel', async (c) => {
  const supabase = c.get('supabase');
  const scheduleId = c.req.param('id');
  const body = await c.req.json();

  try {
    const request = cancelScheduleSchema.parse(body);
    const result = await cancelSchedule(supabase, scheduleId, request);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * DELETE /api/admin/schedule/daily/:id
 * 수동 예정 출석 삭제
 */
adminRoutes.delete('/schedule/daily/:id', async (c) => {
  const supabase = c.get('supabase');
  const scheduleId = c.req.param('id');

  try {
    const result = await deleteSchedule(supabase, scheduleId);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      if (error.code === 'CANNOT_DELETE_AUTO_SCHEDULE') {
        return respond(c, failure(403, error.code, error.message));
      }
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

// ========== Stats Routes ==========

/**
 * GET /api/admin/stats/summary
 * 기간별 통계 요약
 */
adminRoutes.get('/stats/summary', async (c) => {
  const supabase = c.get('supabase');
  const query = {
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
  };

  try {
    const params = getStatsSummaryQuerySchema.parse(query);
    const result = await getStatsSummary(supabase, params);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/admin/stats/daily
 * 일별 통계 조회
 */
adminRoutes.get('/stats/daily', async (c) => {
  const supabase = c.get('supabase');
  const query = {
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
  };

  try {
    const params = getDailyStatsQuerySchema.parse(query);
    const result = await getDailyStats(supabase, params);
    return respond(c, success({ data: result }, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

export default adminRoutes;

import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
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
  generateScheduleRequestSchema,
  batchGenerateSchema,
  updateRoomMappingSchema,
  createRoomMappingSchema,
  getSyncLogsQuerySchema,
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
  generateScheduledAttendances,
  batchGenerateSchedules,
  batchCalculateStats,
  getStatsSummary,
  getDailyStats,
  getRoomMappings,
  updateRoomMapping,
  createRoomMapping,
  deleteRoomMapping,
  getSyncLogs,
  getSyncLogById,
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
  const user = c.get('user');
  const staffId = c.req.param('id');
  const body = await c.req.json();

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const currentUserId = user.sub; // JWT의 sub 필드에서 현재 사용자 ID 추출

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
 * - admin: 모든 환자 수정 가능
 * - coordinator: 담당 환자만 수정 가능
 */
adminRoutes.put('/schedule/patterns/:patient_id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const patientId = c.req.param('patient_id');
  const body = await c.req.json();

  // coordinator인 경우 담당 환자 검증
  if (user && user.role === 'coordinator') {
    const { data: patient } = await (supabase
      .from('patients') as any)
      .select('coordinator_id')
      .eq('id', patientId)
      .single();

    if (!patient || patient.coordinator_id !== user.sub) {
      return respond(c, failure(403, 'FORBIDDEN', '담당 환자가 아닙니다'));
    }
  }

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

// ========== Schedule Generation Routes ==========

/**
 * POST /api/admin/schedule/generate
 * 단일 날짜 스케줄 자동 생성
 */
adminRoutes.post('/schedule/generate', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  try {
    const request = generateScheduleRequestSchema.parse(body);
    const result = await generateScheduledAttendances(supabase, request.date);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/admin/schedule/generate/batch
 * 기간 일괄 스케줄 생성
 */
adminRoutes.post('/schedule/generate/batch', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  try {
    const request = batchGenerateSchema.parse(body);
    const result = await batchGenerateSchedules(supabase, request);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

// ========== Stats Routes ==========

/**
 * POST /api/admin/stats/recalculate
 * 기간 통계 재계산
 */
adminRoutes.post('/stats/recalculate', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  try {
    const request = batchGenerateSchema.parse(body);
    const result = await batchCalculateStats(supabase, request);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

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

// ========== Room Mapping Routes ==========

/**
 * GET /api/admin/settings/room-mapping
 * 호실-담당자 매핑 목록 조회
 */
adminRoutes.get('/settings/room-mapping', async (c) => {
  const supabase = c.get('supabase');

  try {
    const result = await getRoomMappings(supabase);
    return respond(c, success({ data: result }, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * PUT /api/admin/settings/room-mapping/:room_prefix
 * 호실 매핑 수정
 */
adminRoutes.put('/settings/room-mapping/:room_prefix', async (c) => {
  const supabase = c.get('supabase');
  const roomPrefix = c.req.param('room_prefix');
  const body = await c.req.json();

  try {
    const request = updateRoomMappingSchema.parse(body);
    const result = await updateRoomMapping(supabase, roomPrefix, request);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/admin/settings/room-mapping
 * 새 호실 매핑 추가
 */
adminRoutes.post('/settings/room-mapping', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json();

  try {
    const request = createRoomMappingSchema.parse(body);
    const result = await createRoomMapping(supabase, request);
    return respond(c, success(result, 201));
  } catch (error) {
    if (error instanceof AdminError) {
      if (error.code === 'ROOM_MAPPING_ALREADY_EXISTS') {
        return respond(c, failure(409, error.code, error.message));
      }
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * DELETE /api/admin/settings/room-mapping/:room_prefix
 * 호실 매핑 삭제
 */
adminRoutes.delete('/settings/room-mapping/:room_prefix', async (c) => {
  const supabase = c.get('supabase');
  const roomPrefix = c.req.param('room_prefix');

  try {
    const result = await deleteRoomMapping(supabase, roomPrefix);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

// ========== Sync Routes ==========

/**
 * GET /api/admin/sync/logs
 * 동기화 이력 조회
 */
adminRoutes.get('/sync/logs', async (c) => {
  const supabase = c.get('supabase');
  const query = {
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  };

  try {
    const params = getSyncLogsQuerySchema.parse(query);
    const result = await getSyncLogs(supabase, params);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/admin/sync/logs/:id
 * 동기화 상세 조회
 */
adminRoutes.get('/sync/logs/:id', async (c) => {
  const supabase = c.get('supabase');
  const logId = c.req.param('id');

  try {
    const result = await getSyncLogById(supabase, logId);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(404, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/admin/sync
 * 환자 데이터 동기화 실행 (Excel 업로드)
 */
adminRoutes.post('/sync', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const dryRunStr = formData.get('dryRun') as string | null;
    const dryRun = dryRunStr === 'true';

    if (!file) {
      return respond(c, failure(400, 'FILE_REQUIRED', '파일을 첨부해주세요'));
    }

    // 파일 타입 검증
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      return respond(
        c,
        failure(400, 'INVALID_FILE_TYPE', 'Excel 파일만 업로드 가능합니다')
      );
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 동기화 서비스 실행
    const { PatientSyncService } = await import(
      '@/server/services/patient-sync'
    );
    const syncService = new PatientSyncService(supabase);

    const result = await syncService.syncPatients(buffer, {
      dryRun,
      source: 'excel_upload',
      triggeredBy: user.name || user.sub,
    });

    return respond(c, success(result, 200));
  } catch (error: any) {
    console.error('Sync error:', error);
    return respond(
      c,
      failure(500, 'SYNC_FAILED', error.message || '동기화 중 오류가 발생했습니다')
    );
  }
});

export default adminRoutes;

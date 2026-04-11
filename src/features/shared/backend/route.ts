import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import {
  getStatsSummary,
  getDailyStats,
  getHolidays,
} from '@/features/admin/backend/service';
import { AdminError } from '@/features/admin/backend/error';
import {
  getStatsSummaryQuerySchema,
  getDailyStatsQuerySchema,
  getHolidaysQuerySchema,
} from '@/features/admin/backend/schema';
import {
  GetTasksParamsSchema,
  GetMessagesParamsSchema,
  MarkMessageReadRequestSchema,
} from '@/features/doctor/backend/schema';
import {
  getTasks,
  getMessages,
  markMessageRead,
} from '@/features/doctor/backend/service';
import { DoctorError, DoctorErrorCode } from '@/features/doctor/backend/error';
import { comparePassword, hashPassword } from '@/lib/auth';
import { getPatientVitalsQuerySchema } from '@/features/vitals-monitoring/backend/schema';
import { getVitalsOverview, getPatientVitalsDetail } from '@/features/vitals-monitoring/backend/service';
import absenceRiskRoutes from '@/features/absence-risk/backend/route';
import highlightsRoutes from '@/features/highlights/backend/route';
import notificationRoutes from '@/features/notification/backend/route';
import attendanceBoardRoutes from '@/features/attendance-board/backend/route';
import { uploadPatientAvatar, deletePatientAvatar } from './service';
import { AvatarError } from './error';

const updateDisplayNameSchema = z.object({
  display_name: z.string().max(100, '표시명은 100자 이하이어야 합니다').nullable(),
});

const sharedRoutes = new Hono<AppEnv>();

// ========== Patient Display Name ==========

/**
 * PATCH /api/shared/patients/:id/display-name
 * 환자 표시명 변경 (동명이인 구별용)
 */
sharedRoutes.patch('/patients/:id/display-name', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const patientId = c.req.param('id');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const body = await c.req.json();
  const parseResult = updateDisplayNameSchema.safeParse(body);

  if (!parseResult.success) {
    return respond(c, failure(400, 'INVALID_REQUEST', parseResult.error.issues[0]?.message || '잘못된 요청입니다'));
  }

  const displayName = parseResult.data.display_name?.trim() || null;

  const { data, error } = await supabase
    .from('patients')
    .update({ display_name: displayName })
    .eq('id', patientId)
    .select('id, name, display_name')
    .single();

  if (error || !data) {
    const msg = error?.message?.includes('display_name')
      ? '표시명 컬럼이 아직 생성되지 않았습니다. 마이그레이션을 먼저 적용해주세요.'
      : '환자를 찾을 수 없습니다';
    return respond(c, failure(error?.message?.includes('display_name') ? 500 : 404, 'PATIENT_NOT_FOUND', msg));
  }

  return respond(c, success({ patient: data }, 200));
});

// ========== Patient Avatar ==========

/**
 * POST /api/shared/patients/:id/avatar
 * 환자 프로필 사진 업로드
 */
sharedRoutes.post('/patients/:id/avatar', async (c) => {
  const supabase = c.get('supabase');
  const patientId = c.req.param('id');

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return respond(c, failure(400, 'FILE_REQUIRED', '파일을 첨부해주세요'));
  }

  try {
    const result = await uploadPatientAvatar(supabase, patientId, file);
    const cacheBustUrl = `${result.avatarUrl}?t=${Date.now()}`;
    return respond(c, success({ avatar_url: cacheBustUrl }, 200));
  } catch (err) {
    if (err instanceof AvatarError) {
      const status = err.code === 'INVALID_FILE_TYPE' || err.code === 'FILE_TOO_LARGE' ? 400 : 500;
      return respond(c, failure(status, err.code, err.message));
    }
    throw err;
  }
});

/**
 * DELETE /api/shared/patients/:id/avatar
 * 환자 프로필 사진 삭제
 */
sharedRoutes.delete('/patients/:id/avatar', async (c) => {
  const supabase = c.get('supabase');
  const patientId = c.req.param('id');

  try {
    await deletePatientAvatar(supabase, patientId);
    return respond(c, success(null, 200));
  } catch (err) {
    if (err instanceof AvatarError) {
      return respond(c, failure(500, err.code, err.message));
    }
    throw err;
  }
});

// ========== Tasks & Messages Routes (전 역할 접근, 코디는 담당 환자만) ==========

/**
 * GET /api/shared/tasks
 * 지시사항 목록 조회 (역할별 필터링)
 * - doctor/nurse/admin: 전체 환자
 * - coordinator: 담당 환자만
 */
sharedRoutes.get('/tasks', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const query = c.req.query();
  const parseResult = GetTasksParamsSchema.safeParse({
    date: query.date,
    start_date: query.start_date,
    end_date: query.end_date,
    status: query.status,
  });

  if (!parseResult.success) {
    return respond(c, failure(400, 'INVALID_REQUEST', parseResult.error.message));
  }

  try {
    const options = user.role === 'coordinator' ? { coordinatorId: user.sub } : undefined;
    const tasks = await getTasks(supabase, user.sub, parseResult.data, options);
    return respond(c, success(tasks, 200));
  } catch (error) {
    if (error instanceof DoctorError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/shared/messages
 * 전달사항 목록 조회 (역할별 필터링)
 * - doctor/nurse/admin: 전체 환자
 * - coordinator: 담당 환자만
 */
sharedRoutes.get('/messages', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const query = c.req.query();
  const parseResult = GetMessagesParamsSchema.safeParse({
    date: query.date,
    start_date: query.start_date,
    end_date: query.end_date,
    is_read: query.is_read,
  });

  if (!parseResult.success) {
    return respond(c, failure(400, 'INVALID_REQUEST', parseResult.error.message));
  }

  try {
    const options = user.role === 'coordinator' ? { coordinatorId: user.sub } : undefined;
    const messages = await getMessages(supabase, parseResult.data, options);
    return respond(c, success(messages, 200));
  } catch (error) {
    if (error instanceof DoctorError) {
      return respond(c, failure(500, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/shared/messages/:messageId/read
 * 메시지 읽음 처리
 */
sharedRoutes.post('/messages/:messageId/read', async (c) => {
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
    return respond(c, failure(400, 'INVALID_REQUEST', parseResult.error.message));
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

// ========== Stats Routes (읽기 전용, 전 역할 접근 가능) ==========

/**
 * GET /api/shared/stats/summary
 * 기간별 통계 요약
 */
sharedRoutes.get('/stats/summary', async (c) => {
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
 * GET /api/shared/stats/daily
 * 일별 통계 조회
 */
sharedRoutes.get('/stats/daily', async (c) => {
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

/**
 * GET /api/shared/holidays
 * 공휴일 목록 조회 (읽기 전용, 차트 마커 표시용)
 */
sharedRoutes.get('/holidays', async (c) => {
  const supabase = c.get('supabase');
  const query = {
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
  };

  try {
    const params = getHolidaysQuerySchema.parse(query);
    const result = await getHolidays(supabase, params);
    return respond(c, success({ data: result }, 200));
  } catch (error) {
    if (error instanceof AdminError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

// ========== Password Change ==========

/**
 * POST /api/shared/change-password
 * 자기 비밀번호 변경
 */
sharedRoutes.post('/change-password', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const body = await c.req.json();
  const { current_password, new_password } = body;

  if (!current_password || !new_password) {
    return respond(c, failure(400, 'INVALID_INPUT', '현재 비밀번호와 새 비밀번호를 입력해주세요'));
  }

  if (new_password.length < 4) {
    return respond(c, failure(400, 'INVALID_INPUT', '새 비밀번호는 4자 이상이어야 합니다'));
  }

  try {
    // 현재 사용자 조회
    const { data: staff, error } = await supabase
      .from('staff')
      .select('id, password_hash')
      .eq('id', user.sub)
      .single();

    if (error || !staff) {
      return respond(c, failure(404, 'NOT_FOUND', '사용자를 찾을 수 없습니다'));
    }

    // 현재 비밀번호 확인
    const isValid = await comparePassword(current_password, staff.password_hash);
    if (!isValid) {
      return respond(c, failure(401, 'INVALID_PASSWORD', '현재 비밀번호가 올바르지 않습니다'));
    }

    // 새 비밀번호 해싱 및 업데이트
    const newHash = await hashPassword(new_password);
    const { error: updateError } = await supabase
      .from('staff')
      .update({ password_hash: newHash })
      .eq('id', user.sub);

    if (updateError) {
      return respond(c, failure(500, 'UPDATE_FAILED', '비밀번호 변경에 실패했습니다'));
    }

    return respond(c, success({ message: '비밀번호가 변경되었습니다' }, 200));
  } catch (err) {
    return respond(c, failure(500, 'INTERNAL_ERROR', '비밀번호 변경 중 오류가 발생했습니다'));
  }
});

/**
 * GET /api/shared/patient/:id/attendance-calendar?year=YYYY&month=MM
 * 환자별 월간 출석/예정 데이터
 */
sharedRoutes.get('/patient/:id/attendance-calendar', async (c) => {
  const supabase = c.get('supabase');
  const patientId = c.req.param('id');
  const now = new Date();
  const year = parseInt(c.req.query('year') || String(now.getFullYear()));
  const month = parseInt(c.req.query('month') || String(now.getMonth() + 1));

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [
    { data: attendances },
    { data: scheduledAttendances },
    { data: consultations },
  ] = await Promise.all([
    supabase.from('attendances')
      .select('date')
      .eq('patient_id', patientId)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase.from('scheduled_attendances')
      .select('date, is_cancelled')
      .eq('patient_id', patientId)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase.from('consultations')
      .select('date')
      .eq('patient_id', patientId)
      .gte('date', startDate)
      .lte('date', endDate),
  ]);

  return respond(c, success({
    attended_dates: (attendances || []).map((a) => a.date),
    scheduled_dates: (scheduledAttendances || [])
      .filter((s) => !s.is_cancelled)
      .map((s) => s.date),
    consulted_dates: (consultations || []).map((con) => con.date),
  }, 200));
});

// ========== Notifications ==========

sharedRoutes.route('/notifications', notificationRoutes);

// ========== Absence Risk ==========

sharedRoutes.route('/absence-risk', absenceRiskRoutes);

// ========== Today's Highlights ==========

sharedRoutes.route('/highlights', highlightsRoutes);

// ========== Vitals Monitoring ==========

/**
 * GET /api/shared/vitals/overview
 * 전체 환자 활력징후 요약 (최근 30일 기준)
 */
sharedRoutes.get('/vitals/overview', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  try {
    const overview = await getVitalsOverview(supabase);
    return respond(c, success(overview, 200));
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/shared/vitals/:patientId
 * 개별 환자 시계열 데이터 + 통계
 */
sharedRoutes.get('/vitals/:patientId', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  const patientId = c.req.param('patientId');
  const query = c.req.query();
  const parseResult = getPatientVitalsQuerySchema.safeParse({ period: query.period });

  if (!parseResult.success) {
    return respond(c, failure(400, 'INVALID_REQUEST', parseResult.error.issues[0]?.message || '잘못된 요청입니다'));
  }

  try {
    const detail = await getPatientVitalsDetail(supabase, patientId, parseResult.data.period);
    return respond(c, success(detail, 200));
  } catch (error) {
    if (error instanceof Error && error.message === '환자를 찾을 수 없습니다') {
      return respond(c, failure(404, 'PATIENT_NOT_FOUND', error.message));
    }
    throw error;
  }
});

// ========== Attendance Board ==========

sharedRoutes.route('/attendance-board', attendanceBoardRoutes);

export default sharedRoutes;

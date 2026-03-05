import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import {
  getStatsSummary,
  getDailyStats,
} from '@/features/admin/backend/service';
import { AdminError } from '@/features/admin/backend/error';
import {
  getStatsSummaryQuerySchema,
  getDailyStatsQuerySchema,
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

const sharedRoutes = new Hono<AppEnv>();

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
    const { data: staff, error } = await (supabase
      .from('staff') as any)
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
    const { error: updateError } = await (supabase
      .from('staff') as any)
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
  ] = await Promise.all([
    (supabase.from('attendances') as any)
      .select('date')
      .eq('patient_id', patientId)
      .gte('date', startDate)
      .lte('date', endDate),
    (supabase.from('scheduled_attendances') as any)
      .select('date, is_cancelled')
      .eq('patient_id', patientId)
      .gte('date', startDate)
      .lte('date', endDate),
  ]);

  return respond(c, success({
    attended_dates: (attendances || []).map((a: any) => a.date),
    scheduled_dates: (scheduledAttendances || [])
      .filter((s: any) => !s.is_cancelled)
      .map((s: any) => s.date),
  }, 200));
});

export default sharedRoutes;

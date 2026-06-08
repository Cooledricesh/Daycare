import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { AttendanceBoardError } from './error';
import { getAttendanceBoardSchema } from './schema';
import { getAttendanceBoard, getStreaksForActivePatients } from './service';
import { getTodayString } from '@/lib/date';

const attendanceBoardRoutes = new Hono<AppEnv>();

/**
 * GET /api/shared/attendance-board/streaks
 * 전 활성 환자 연속 출석/진찰 스트릭 맵 (대시보드 뱃지용)
 */
attendanceBoardRoutes.get('/streaks', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }
  const date = c.req.query('date') || getTodayString();
  try {
    const result = await getStreaksForActivePatients(supabase, date);
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof AttendanceBoardError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/staff/attendance-board
 * 출석 보드 데이터 조회 (전체 호실별 출석 현황)
 */
attendanceBoardRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const date = c.req.query('date');

  if (!user) {
    return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
  }

  try {
    const params = getAttendanceBoardSchema.parse({ date });
    const board = await getAttendanceBoard(supabase, params);
    return respond(c, success(board, 200));
  } catch (error) {
    if (error instanceof AttendanceBoardError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

export default attendanceBoardRoutes;

import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { AttendanceBoardError } from './error';
import { getAttendanceBoardSchema } from './schema';
import { getAttendanceBoard } from './service';

const attendanceBoardRoutes = new Hono<AppEnv>();

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

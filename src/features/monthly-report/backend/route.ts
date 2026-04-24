import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { MonthlyReportError, MonthlyReportErrorCodes } from './error';
import {
  MonthlyReportParamsSchema,
  ActionItemsUpdateSchema,
} from './schema';
import {
  getMonthlyReport,
  regenerateMonthlyReport,
  updateActionItems,
  listMonthlyReports,
} from './service';

const monthlyReportRoutes = new Hono<AppEnv>();

/**
 * GET /api/admin/monthly-reports
 * 생성된 리포트 목록 (연도/월/generated_at)
 */
monthlyReportRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');

  try {
    const list = await listMonthlyReports(supabase);
    return respond(c, success(list, 200));
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

/**
 * GET /api/admin/monthly-reports/:year/:month
 * 해당 월 리포트 조회 (없으면 즉시 생성 후 반환)
 */
monthlyReportRoutes.get('/:year/:month', async (c) => {
  const supabase = c.get('supabase');
  const rawYear = c.req.param('year');
  const rawMonth = c.req.param('month');

  const parsed = MonthlyReportParamsSchema.safeParse({
    year: rawYear,
    month: rawMonth,
  });

  if (!parsed.success) {
    return respond(
      c,
      failure(400, MonthlyReportErrorCodes.INVALID_PERIOD, '유효하지 않은 연도/월'),
    );
  }

  const { year, month } = parsed.data;

  try {
    const report = await getMonthlyReport(supabase, year, month);
    return respond(c, success(report, 200));
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      if (error.code === MonthlyReportErrorCodes.INVALID_PERIOD) {
        return respond(c, failure(400, error.code, error.message));
      }
      if (error.code === MonthlyReportErrorCodes.NOT_FOUND) {
        return respond(c, failure(404, error.code, error.message));
      }
      return respond(c, failure(500, error.code, error.message));
    }
    throw error;
  }
});

/**
 * POST /api/admin/monthly-reports/:year/:month/regenerate
 * 리포트 강제 재계산 (action_items 보존)
 */
monthlyReportRoutes.post('/:year/:month/regenerate', async (c) => {
  const supabase = c.get('supabase');
  const rawYear = c.req.param('year');
  const rawMonth = c.req.param('month');

  const parsed = MonthlyReportParamsSchema.safeParse({
    year: rawYear,
    month: rawMonth,
  });

  if (!parsed.success) {
    return respond(
      c,
      failure(400, MonthlyReportErrorCodes.INVALID_PERIOD, '유효하지 않은 연도/월'),
    );
  }

  const { year, month } = parsed.data;

  try {
    const report = await regenerateMonthlyReport(supabase, year, month);
    return respond(c, success(report, 200));
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      if (error.code === MonthlyReportErrorCodes.INVALID_PERIOD) {
        return respond(c, failure(400, error.code, error.message));
      }
      return respond(c, failure(500, error.code, error.message));
    }
    throw error;
  }
});

/**
 * PATCH /api/admin/monthly-reports/:year/:month/action-items
 * 액션 아이템 메모 업데이트
 */
monthlyReportRoutes.patch('/:year/:month/action-items', async (c) => {
  const supabase = c.get('supabase');
  const rawYear = c.req.param('year');
  const rawMonth = c.req.param('month');

  const parsed = MonthlyReportParamsSchema.safeParse({
    year: rawYear,
    month: rawMonth,
  });

  if (!parsed.success) {
    return respond(
      c,
      failure(400, MonthlyReportErrorCodes.INVALID_PERIOD, '유효하지 않은 연도/월'),
    );
  }

  const { year, month } = parsed.data;

  const body = await c.req.json().catch(() => null);
  const bodyParsed = ActionItemsUpdateSchema.safeParse(body);

  if (!bodyParsed.success) {
    return respond(
      c,
      failure(400, MonthlyReportErrorCodes.ACTION_ITEMS_TOO_LONG, '액션 아이템이 너무 깁니다'),
    );
  }

  try {
    const result = await updateActionItems(
      supabase,
      year,
      month,
      bodyParsed.data.action_items,
    );
    return respond(c, success(result, 200));
  } catch (error) {
    if (error instanceof MonthlyReportError) {
      if (error.code === MonthlyReportErrorCodes.NOT_FOUND) {
        return respond(c, failure(404, error.code, error.message));
      }
      return respond(c, failure(400, error.code, error.message));
    }
    throw error;
  }
});

export default monthlyReportRoutes;

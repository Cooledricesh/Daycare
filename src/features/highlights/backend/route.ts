import { Hono } from 'hono';
import type { AppEnv } from '@/server/hono/context';
import { success, failure, respond } from '@/server/http/response';
import { computeTodayHighlights } from './service';
import { HighlightsError } from './error';

const highlightsRoutes = new Hono<AppEnv>();

highlightsRoutes.get('/today', async (c) => {
  const supabase = c.get('supabase');
  try {
    const result = await computeTodayHighlights(supabase);
    return respond(c, success(result, 200));
  } catch (err) {
    if (err instanceof HighlightsError) {
      return respond(c, failure(500, err.code, err.message));
    }
    throw err;
  }
});

export default highlightsRoutes;

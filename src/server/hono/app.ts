import { Hono } from 'hono';
import { errorBoundary } from '@/server/middleware/error';
import { withAppContext } from '@/server/middleware/context';
import { withSupabase } from '@/server/middleware/supabase';
import { withAuth } from '@/server/middleware/auth';
import { requireRole } from '@/server/middleware/rbac';
import { success, failure, respond } from '@/server/http/response';
import type { AppEnv } from '@/server/hono/context';
import patientRoutes from '@/features/patient/backend/route';
import adminRoutes from '@/features/admin/backend/route';
import staffRoutes from '@/features/staff/backend/route';
import nurseRoutes from '@/features/nurse/backend/route';
import doctorRoutes from '@/features/doctor/backend/route';

let singletonApp: Hono<AppEnv> | null = null;

export const createHonoApp = () => {
  if (singletonApp) {
    return singletonApp;
  }

  const app = new Hono<AppEnv>();

  // 공통 미들웨어 (순서 중요: error -> context -> supabase -> auth)
  app.use('*', errorBoundary());
  app.use('*', withAppContext());
  app.use('*', withSupabase());

  // JWT 인증 + RBAC 미들웨어 (역할별 접근 제어)
  app.use('/api/staff/*', withAuth(), requireRole('coordinator', 'admin'));
  app.use('/api/nurse/*', withAuth(), requireRole('nurse', 'admin'));
  app.use('/api/doctor/*', withAuth(), requireRole('doctor', 'admin'));
  // schedule patterns는 coordinator도 접근 가능 (담당 환자만 수정 가능)
  app.use('/api/admin/schedule/patterns/*', withAuth(), requireRole('coordinator', 'admin'));
  app.use('/api/admin/schedule/patterns', withAuth(), requireRole('coordinator', 'admin'));
  app.use('/api/admin/*', withAuth(), requireRole('admin'));
  app.use('/api/me', withAuth());

  // 현재 로그인한 사용자 정보 조회
  app.get('/api/me', (c) => {
    const user = c.get('user');
    if (!user) {
      return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
    }
    return respond(c, success({
      id: user.sub,
      name: user.name,
      role: user.role,
    }, 200));
  });

  // Feature routes
  app.route('/api/patients', patientRoutes);
  app.route('/api/admin', adminRoutes);
  app.route('/api/staff', staffRoutes);
  app.route('/api/nurse', nurseRoutes);
  app.route('/api/doctor', doctorRoutes);

  singletonApp = app;

  return app;
};

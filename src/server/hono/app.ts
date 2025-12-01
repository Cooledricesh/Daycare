import { Hono } from 'hono';
import { errorBoundary } from '@/server/middleware/error';
import { withAppContext } from '@/server/middleware/context';
import { withSupabase } from '@/server/middleware/supabase';
import type { AppEnv } from '@/server/hono/context';
import patientRoutes from '@/features/patient/backend/route';
import adminRoutes from '@/features/admin/backend/route';
import staffRoutes from '@/features/staff/backend/route';
import nurseRoutes from '@/features/nurse/backend/route';

let singletonApp: Hono<AppEnv> | null = null;

export const createHonoApp = () => {
  if (singletonApp) {
    return singletonApp;
  }

  const app = new Hono<AppEnv>();

  app.use('*', errorBoundary());
  app.use('*', withAppContext());
  app.use('*', withSupabase());

  // Feature routes
  app.route('/api/patients', patientRoutes);
  app.route('/api/admin', adminRoutes);
  app.route('/api', patientRoutes);
  app.route('/api/staff', staffRoutes);
  app.route('/api/nurse', nurseRoutes);

  singletonApp = app;

  return app;
};

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '@/server/hono/context';
import { failure, respond } from '@/server/http/response';

/**
 * 허용된 역할 타입
 */
export type AllowedRole = 'admin' | 'doctor' | 'coordinator' | 'nurse';

/**
 * Role-Based Access Control (RBAC) 미들웨어
 *
 * 지정된 역할을 가진 사용자만 접근을 허용합니다.
 * withAuth() 미들웨어 다음에 사용해야 합니다.
 *
 * @example
 * // 단일 역할 허용
 * app.use('/api/admin/*', withAuth(), requireRole('admin'));
 *
 * // 여러 역할 허용
 * app.use('/api/staff/*', withAuth(), requireRole('coordinator', 'admin'));
 */
export const requireRole = (...allowedRoles: AllowedRole[]) => {
  return createMiddleware<AppEnv>(async (c, next) => {
    const logger = c.get('logger');
    const user = c.get('user');

    // withAuth() 미들웨어가 먼저 실행되었는지 확인
    if (!user) {
      logger.error('RBAC middleware called without prior auth - user not in context');
      return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
    }

    const userRole = user.role as AllowedRole;

    // 역할 확인
    if (!allowedRoles.includes(userRole)) {
      logger.warn(
        `Access denied: user ${user.sub} with role '${userRole}' tried to access route requiring ${allowedRoles.join(' or ')}`,
      );
      return respond(
        c,
        failure(403, 'FORBIDDEN', '이 기능에 접근할 권한이 없습니다'),
      );
    }

    logger.debug(`RBAC passed: user ${user.sub} has role '${userRole}'`);
    await next();
  });
};

/**
 * 자기 자신만 접근할 수 있도록 제한하는 미들웨어
 * URL 파라미터의 ID와 현재 사용자 ID를 비교합니다.
 *
 * @param paramName URL 파라미터 이름 (기본값: 'id')
 * @param allowAdminBypass admin 역할의 우회 허용 여부 (기본값: true)
 *
 * @example
 * // /api/staff/:id 에서 본인만 접근 가능 (admin은 우회 가능)
 * app.get('/api/staff/:id/profile', withAuth(), requireSelf('id', true));
 */
export const requireSelf = (paramName = 'id', allowAdminBypass = true) => {
  return createMiddleware<AppEnv>(async (c, next) => {
    const logger = c.get('logger');
    const user = c.get('user');

    if (!user) {
      logger.error('requireSelf middleware called without prior auth');
      return respond(c, failure(401, 'UNAUTHORIZED', '인증이 필요합니다'));
    }

    const targetId = c.req.param(paramName);
    const userId = user.sub;

    // admin 우회 허용
    if (allowAdminBypass && user.role === 'admin') {
      logger.debug(`Admin bypass: user ${userId} accessing resource ${targetId}`);
      await next();
      return;
    }

    // 자기 자신인지 확인
    if (targetId !== userId) {
      logger.warn(
        `Self-access denied: user ${userId} tried to access resource of ${targetId}`,
      );
      return respond(
        c,
        failure(403, 'FORBIDDEN', '본인의 정보만 접근할 수 있습니다'),
      );
    }

    await next();
  });
};

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '@/server/hono/context';
import { verifyJWT } from '@/lib/token';
import { failure, respond } from '@/server/http/response';

/**
 * JWT 인증 미들웨어
 * Authorization 헤더 또는 쿠키에서 JWT 토큰을 추출하여 검증하고,
 * 검증된 사용자 정보를 Context에 주입합니다.
 */
export const withAuth = () => {
  return createMiddleware<AppEnv>(async (c, next) => {
    const logger = c.get('logger');

    // 1. 토큰 추출 (Authorization 헤더 우선, 없으면 쿠키)
    let token: string | undefined;

    // Authorization: Bearer <token>
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 쿠키에서 accessToken 추출
    if (!token) {
      const cookieHeader = c.req.header('cookie');
      if (cookieHeader) {
        const match = cookieHeader.match(/accessToken=([^;]+)/);
        token = match?.[1];
      }
    }

    // 2. 토큰 없음 -> 401 Unauthorized
    if (!token) {
      logger.warn('JWT token not found in Authorization header or cookie');
      return respond(c, failure(401, 'UNAUTHORIZED', '인증 토큰이 필요합니다'));
    }

    // 3. 토큰 검증
    const payload = await verifyJWT(token);
    if (!payload) {
      logger.warn('Invalid JWT token');
      return respond(c, failure(401, 'INVALID_TOKEN', '유효하지 않은 인증 토큰입니다'));
    }

    // 4. 사용자 정보 Context에 주입
    c.set('user', {
      sub: payload.sub as string,
      role: payload.role as string,
      name: payload.name as string,
      iat: payload.iat,
      exp: payload.exp,
    });

    logger.info(`Authenticated user: ${payload.sub} (${payload.role})`);

    await next();
  });
};

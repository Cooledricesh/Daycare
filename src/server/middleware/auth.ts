import { createMiddleware } from 'hono/factory';
import { deleteCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '@/server/hono/context';
import { signJWT, verifyJWT } from '@/lib/token';
import { failure, respond } from '@/server/http/response';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  getAuthSessionRefreshDurationSeconds,
  shouldRefreshAuthSession,
} from '@/constants/auth-session';

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
        const match = cookieHeader.match(new RegExp(`${ACCESS_TOKEN_COOKIE_NAME}=([^;]+)`));
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

    const sessionStartedAt =
      typeof payload.sessionStartedAt === 'number'
        ? payload.sessionStartedAt
        : payload.iat;
    const nowSeconds = Math.floor(Date.now() / 1000);
    let authenticatedUser = {
      sub: payload.sub as string,
      role: payload.role as string,
      name: payload.name as string,
      sessionStartedAt,
      iat: payload.iat,
      exp: payload.exp,
    };
    let refreshDurationSeconds = 0;

    if (shouldRefreshAuthSession(payload.exp, nowSeconds, sessionStartedAt)) {
      const supabase = c.get('supabase');
      const { data: currentStaff, error } = await supabase
        .from('staff')
        .select('id, name, role, is_active')
        .eq('id', payload.sub as string)
        .maybeSingle();

      if (error) {
        logger.warn(`Session refresh staff lookup failed: ${error.message}`);
        return respond(
          c,
          failure(
            503,
            'SESSION_REVALIDATION_FAILED',
            '로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요',
          ),
        );
      } else if (!currentStaff || !currentStaff.is_active) {
        deleteCookie(c, ACCESS_TOKEN_COOKIE_NAME, { path: '/' });
        return respond(c, failure(401, 'INACTIVE_ACCOUNT', '비활성화된 계정입니다'));
      } else {
        authenticatedUser = {
          ...authenticatedUser,
          role: currentStaff.role,
          name: currentStaff.name,
        };
        refreshDurationSeconds = getAuthSessionRefreshDurationSeconds(
          sessionStartedAt ?? nowSeconds,
          nowSeconds,
        );
      }
    }

    // 4. 현재 사용자 정보 Context에 주입
    c.set('user', authenticatedUser);

    logger.info(`Authenticated user: ${authenticatedUser.sub} (${authenticatedUser.role})`);

    await next();

    if (refreshDurationSeconds > 0) {
      const refreshedToken = await signJWT({
        sub: authenticatedUser.sub,
        role: authenticatedUser.role,
        name: authenticatedUser.name,
        sessionStartedAt: sessionStartedAt ?? nowSeconds,
      }, refreshDurationSeconds);
      setCookie(c, ACCESS_TOKEN_COOKIE_NAME, refreshedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: refreshDurationSeconds,
        path: '/',
      });
    }
  });
};

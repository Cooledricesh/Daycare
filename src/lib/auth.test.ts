// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { signJWT, verifyJWT, hashPassword, comparePassword } from './auth';
import {
  AUTH_SESSION_ABSOLUTE_DURATION_SECONDS,
  AUTH_SESSION_DURATION_SECONDS,
  AUTH_SESSION_REFRESH_THRESHOLD_SECONDS,
  getAuthSessionRefreshDurationSeconds,
  shouldRefreshAuthSession,
} from '@/constants/auth-session';

describe('auth', () => {
  describe('signJWT', () => {
    it('JWT 토큰을 생성한다', async () => {
      const payload = {
        sub: 'user123',
        role: 'doctor',
        name: '홍길동',
      };

      const token = await signJWT(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('서로 다른 payload는 서로 다른 토큰을 생성한다', async () => {
      const payload1 = { sub: 'user1', role: 'doctor', name: '홍길동' };
      const payload2 = { sub: 'user2', role: 'nurse', name: '김철수' };

      const token1 = await signJWT(payload1);
      const token2 = await signJWT(payload2);

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyJWT', () => {
    it('유효한 JWT 토큰을 검증하고 payload를 반환한다', async () => {
      const payload = {
        sub: 'user123',
        role: 'doctor',
        name: '홍길동',
      };

      const token = await signJWT(payload);
      const verified = await verifyJWT(token);

      expect(verified).toBeDefined();
      expect(verified?.sub).toBe(payload.sub);
      expect(verified?.role).toBe(payload.role);
      expect(verified?.name).toBe(payload.name);
    });

    it('잘못된 토큰은 null을 반환한다', async () => {
      const invalidToken = 'invalid.token.here';
      const verified = await verifyJWT(invalidToken);

      expect(verified).toBeNull();
    });

    it('변조된 토큰은 null을 반환한다', async () => {
      const payload = { sub: 'user123', role: 'doctor', name: '홍길동' };
      const token = await signJWT(payload);

      const tamperedToken = token.substring(0, token.length - 5) + 'xxxxx';
      const verified = await verifyJWT(tamperedToken);

      expect(verified).toBeNull();
    });

    it('빈 문자열 토큰은 null을 반환한다', async () => {
      const verified = await verifyJWT('');
      expect(verified).toBeNull();
    });

    it('토큰에 설정된 payload 필드를 모두 검증한다', async () => {
      const payload = {
        sub: 'staff-1',
        role: 'coordinator',
        name: '박코디',
      };

      const token = await signJWT(payload);
      const verified = await verifyJWT(token);

      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe('staff-1');
      expect(verified?.role).toBe('coordinator');
      expect(verified?.name).toBe('박코디');
      // iat, exp 필드가 존재하는지 확인
      expect(verified?.iat).toBeDefined();
      expect(verified?.exp).toBeDefined();
      expect((verified?.exp ?? 0) - (verified?.iat ?? 0)).toBe(
        AUTH_SESSION_DURATION_SECONDS,
      );
    });
  });

  describe('shouldRefreshAuthSession', () => {
    const now = 1_000_000;

    it('만료까지 임계값보다 많이 남으면 갱신하지 않는다', () => {
      expect(
        shouldRefreshAuthSession(
          now + AUTH_SESSION_REFRESH_THRESHOLD_SECONDS + 1,
          now,
        ),
      ).toBe(false);
    });

    it('유효한 세션이 갱신 임계값 안에 들어오면 갱신한다', () => {
      expect(
        shouldRefreshAuthSession(
          now + AUTH_SESSION_REFRESH_THRESHOLD_SECONDS,
          now,
        ),
      ).toBe(true);
    });

    it('이미 만료됐거나 만료 정보가 없으면 갱신하지 않는다', () => {
      expect(shouldRefreshAuthSession(now, now)).toBe(false);
      expect(shouldRefreshAuthSession(undefined, now)).toBe(false);
    });

    it('최초 로그인 후 절대 7일이 지나면 갱신하지 않는다', () => {
      const sessionStartedAt = now - AUTH_SESSION_ABSOLUTE_DURATION_SECONDS;
      expect(
        shouldRefreshAuthSession(
          now + AUTH_SESSION_REFRESH_THRESHOLD_SECONDS,
          now,
          sessionStartedAt,
        ),
      ).toBe(false);
    });

    it('마지막 갱신 토큰은 절대 7일 경계를 넘지 않는다', () => {
      const sixHours = 6 * 60 * 60;
      const sessionStartedAt = now - AUTH_SESSION_ABSOLUTE_DURATION_SECONDS + sixHours;
      expect(getAuthSessionRefreshDurationSeconds(sessionStartedAt, now)).toBe(sixHours);
    });
  });

  describe('hashPassword', () => {
    it('비밀번호를 해시한다', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('같은 비밀번호도 매번 다른 해시를 생성한다 (salt)', async () => {
      const password = 'password123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('빈 문자열도 해시할 수 있다', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('comparePassword', () => {
    let password: string;
    let hash: string;

    beforeAll(async () => {
      password = 'password123';
      hash = await hashPassword(password);
    });

    it('올바른 비밀번호는 true를 반환한다', async () => {
      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('잘못된 비밀번호는 false를 반환한다', async () => {
      const isValid = await comparePassword('wrongpassword', hash);
      expect(isValid).toBe(false);
    });

    it('빈 문자열 비밀번호는 false를 반환한다', async () => {
      const isValid = await comparePassword('', hash);
      expect(isValid).toBe(false);
    });

    it('대소문자가 다르면 false를 반환한다', async () => {
      const isValid = await comparePassword('Password123', hash);
      expect(isValid).toBe(false);
    });
  });
});

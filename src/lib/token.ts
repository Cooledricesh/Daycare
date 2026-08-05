import { SignJWT, jwtVerify } from 'jose';
import { AUTH_SESSION_DURATION_SECONDS } from '@/constants/auth-session';

const alg = 'HS256';

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(jwtSecret);
}

export async function signJWT(
    payload: Record<string, unknown>,
    expiresInSeconds = AUTH_SESSION_DURATION_SECONDS,
) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime(`${expiresInSeconds}s`)
        .sign(getSecret());
}

export async function verifyJWT(token: string) {
    try {
        const { payload } = await jwtVerify(token, getSecret());
        return payload;
    } catch (error) {
        return null;
    }
}

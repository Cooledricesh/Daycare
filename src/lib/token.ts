import { SignJWT, jwtVerify } from 'jose';

const alg = 'HS256';

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(jwtSecret);
}

export async function signJWT(payload: any) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime('24h')
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

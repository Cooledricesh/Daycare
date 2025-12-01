import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret-key');
const alg = 'HS256';

export async function signJWT(payload: any) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);
}

export async function verifyJWT(token: string) {
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch (error) {
        return null;
    }
}

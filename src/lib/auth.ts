import bcrypt from 'bcryptjs';
export { signJWT, verifyJWT } from './token';

export async function hashPassword(password: string) {
    return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
}



import { NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE_NAME } from '@/constants/auth-session';

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.delete(ACCESS_TOKEN_COOKIE_NAME);
    return response;
}

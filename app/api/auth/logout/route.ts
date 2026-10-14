import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/jwt';

export async function POST() {
  const response = NextResponse.json({ message: 'Signed out.' });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

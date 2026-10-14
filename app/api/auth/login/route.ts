import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { readJson, jsonError } from '@/lib/http';
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/jwt';
import { cleanString } from '@/lib/validation';

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  const body = await readJson<LoginBody>(request);

  if (!body) {
    return jsonError('Request body must be valid JSON.');
  }

  const email = cleanString(body.email, 150);
  const password =
    typeof body.password === 'string' ? body.password : null;

  if (!email || !password) {
    return jsonError('Email and password are required.');
  }

  try {
    const user = await authenticateUser(email, password);

    if (!user) {
      return jsonError('Invalid email or password.', 401);
    }

    const token = await createSessionToken(user);
    const response = NextResponse.json({
      message: 'Signed in successfully.',
      user,
    });

    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    console.error('[auth/login]', error);
    return jsonError(
      'Authentication service is unavailable. Check the PostgreSQL connection.',
      500,
    );
  }
}

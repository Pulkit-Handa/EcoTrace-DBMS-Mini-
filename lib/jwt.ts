import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';
import type { Role } from './types';

export const SESSION_COOKIE = 'ecotrace_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export interface SessionClaims {
  userId: number;
  name: string;
  email: string;
  role: Role;
  deptId: number | null;
  deptName: string | null;
}

const encoder = new TextEncoder();

function getSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ?? 'ecotrace-local-dev-secret-change-me';
  return encoder.encode(secret);
}

export async function createSessionToken(
  claims: SessionClaims,
): Promise<string> {
  return new SignJWT({
    name: claims.name,
    email: claims.email,
    role: claims.role,
    deptId: claims.deptId,
    deptName: claims.deptName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(claims.userId))
    .setIssuer('ecotrace')
    .setAudience('ecotrace-app')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'ecotrace',
      audience: 'ecotrace-app',
    });

    const userId = Number(payload.sub);
    const role = payload.role;
    const deptId = payload.deptId === null ? null : Number(payload.deptId);

    if (
      !Number.isInteger(userId) ||
      (role !== 'auditor' && role !== 'dept_lead') ||
      typeof payload.name !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return null;
    }

    return {
      userId,
      name: payload.name,
      email: payload.email,
      role,
      deptId: Number.isInteger(deptId) ? deptId : null,
      deptName:
        typeof payload.deptName === 'string' ? payload.deptName : null,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_DURATION_SECONDS,
};

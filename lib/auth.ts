import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { query } from './postgres';
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionClaims,
} from './jwt';
import type { SessionUser } from './types';

interface UserRow {
  user_id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'auditor' | 'dept_lead';
  dept_id: number | null;
  dept_name: string | null;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  return {
    userId: claims.userId,
    name: claims.name,
    email: claims.email,
    role: claims.role,
    deptId: claims.deptId,
    deptName: claims.deptName,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<SessionClaims | null> {
  const rows = await query<UserRow>(
    `SELECT u.user_id, u.name, u.email, u.password_hash, u.role, u.dept_id,
            d.name AS dept_name
       FROM users u
       LEFT JOIN departments d ON d.dept_id = u.dept_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1`,
    [email.trim()],
  );

  const user = rows[0];
  if (!user) return null;

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) return null;

  return {
    userId: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    deptId: user.dept_id,
    deptName: user.dept_name,
  };
}

/**
 * Department scoping rule used by every read query and API route:
 * auditors see every department; department leads only their own.
 */
export function scopedDepartmentId(
  session: SessionUser,
  requestedDepartmentId?: number | null,
): number | null {
  if (session.role === 'dept_lead') {
    return session.deptId;
  }
  return requestedDepartmentId ?? null;
}

export function assertDepartmentAccess(
  session: SessionUser,
  departmentId: number,
): boolean {
  if (session.role === 'auditor') return true;
  return session.deptId === departmentId;
}

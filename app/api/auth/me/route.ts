import { getSession } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError('Not authenticated.', 401);
  return jsonOk({ user: session });
}

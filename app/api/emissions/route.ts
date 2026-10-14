import { getSession, assertDepartmentAccess, scopedDepartmentId } from '@/lib/auth';
import {
  createEmission,
  getComplianceForDepartment,
  getEmissionRecords,
} from '@/lib/queries';
import {
  errorMessage,
  isPostgresError,
  jsonError,
  jsonOk,
  readJson,
} from '@/lib/http';
import {
  cleanString,
  isScope,
  parseLimit,
  toInteger,
  toPositiveNumber,
} from '@/lib/validation';
import type { SessionUser } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface EmissionBody {
  dept_id?: unknown;
  scope?: unknown;
  value_kgco2?: unknown;
  description?: unknown;
}

function resolveDepartment(
  session: SessionUser,
  requested: number | null,
): number | null {
  if (session.role === 'dept_lead') return session.deptId;
  return requested ?? session.deptId;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return jsonError('Not authenticated.', 401);

  const { searchParams } = new URL(request.url);
  const requestedDepartment = toInteger(searchParams.get('dept_id'));
  const scope = toInteger(searchParams.get('scope'));
  const limit = parseLimit(searchParams.get('limit'), 25);

  if (
    session.role === 'dept_lead' &&
    requestedDepartment !== null &&
    requestedDepartment !== session.deptId
  ) {
    return jsonError('You can only access your own department.', 403);
  }

  try {
    const records = await getEmissionRecords({
      departmentId: scopedDepartmentId(session, requestedDepartment),
      scope: scope && isScope(scope) ? scope : null,
      limit,
    });

    return jsonOk({
      records,
      count: records.length,
      scope:
        session.role === 'dept_lead'
          ? `department:${session.deptId}`
          : 'all-departments',
    });
  } catch (error) {
    console.error('[api/emissions GET]', error);
    return jsonError('Could not load emission records.', 500);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError('Not authenticated.', 401);

  const body = await readJson<EmissionBody>(request);
  if (!body) return jsonError('Request body must be valid JSON.');

  const requestedDepartment = toInteger(body.dept_id);
  const departmentId = resolveDepartment(session, requestedDepartment);
  const scope = toInteger(body.scope);
  const value = toPositiveNumber(body.value_kgco2);
  const description = cleanString(body.description, 500);

  if (!departmentId) {
    return jsonError(
      session.role === 'dept_lead'
        ? 'Your account is not assigned to a department.'
        : 'dept_id is required.',
    );
  }

  if (requestedDepartment !== null && !assertDepartmentAccess(session, requestedDepartment)) {
    return jsonError('You can only log emissions for your own department.', 403);
  }

  if (scope === null || !isScope(scope)) {
    return jsonError('scope must be one of 1, 2 or 3.');
  }

  if (value === null) {
    return jsonError('value_kgco2 must be a positive number.');
  }

  if (value > 1_000_000_000) {
    return jsonError('value_kgco2 is unrealistically large.');
  }

  try {
    const record = await createEmission({
      departmentId,
      userId: session.userId,
      scope,
      valueKgco2: Number(value.toFixed(2)),
      description,
    });

    const compliance = await getComplianceForDepartment(departmentId);
    const breached = compliance?.status === 'Non-Compliant';

    return jsonOk(
      {
        message: breached
          ? 'Emission logged. This department is now over its annual cap.'
          : 'Emission logged successfully.',
        record,
        compliance,
        breached,
      },
      201,
    );
  } catch (error) {
    console.error('[api/emissions POST]', error);
    if (isPostgresError(error, '23503')) {
      return jsonError('The selected department does not exist.', 400);
    }
    return jsonError(errorMessage(error), 500);
  }
}

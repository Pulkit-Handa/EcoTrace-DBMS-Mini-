import { getSession, scopedDepartmentId } from '@/lib/auth';
import {
  getDepartments,
  getReportBundle,
} from '@/lib/queries';
import { jsonError, jsonOk } from '@/lib/http';
import { toInteger, toPositiveNumber } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TYPES = new Set([
  'all',
  'scope',
  'compliance',
  'top',
  'breaches',
]);

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return jsonError('Not authenticated.', 401);

  const { searchParams } = new URL(request.url);
  const requestedDepartment = toInteger(searchParams.get('dept_id'));
  const threshold = toPositiveNumber(searchParams.get('threshold')) ?? 1000;
  const type = searchParams.get('type') ?? 'all';

  if (!VALID_TYPES.has(type)) {
    return jsonError(
      'type must be one of: all, scope, compliance, top, breaches.',
    );
  }

  if (
    session.role === 'dept_lead' &&
    requestedDepartment !== null &&
    requestedDepartment !== session.deptId
  ) {
    return jsonError('You can only access your own department.', 403);
  }

  const departmentId = scopedDepartmentId(session, requestedDepartment);

  try {
    const [bundle, departments] = await Promise.all([
      getReportBundle(departmentId, 'pending', threshold),
      getDepartments(),
    ]);

    const visibleDepartment = departmentId
      ? departments.find((department) => department.dept_id === departmentId)
      : null;

    bundle.scope_label =
      session.role === 'dept_lead'
        ? `${session.deptName ?? visibleDepartment?.name ?? 'Your department'} only`
        : visibleDepartment?.name ?? 'All departments';

    const payload: Record<string, unknown> = {
      generated_at: bundle.generated_at,
      scope_label: bundle.scope_label,
      threshold: bundle.threshold,
      requested_type: type,
    };

    if (type === 'all' || type === 'scope') {
      payload.scope_breakdown = bundle.scope_breakdown;
    }
    if (type === 'all' || type === 'compliance') {
      payload.compliance = bundle.compliance;
    }
    if (type === 'all' || type === 'top') {
      payload.top_emitters = bundle.top_emitters;
    }
    if (type === 'all' || type === 'breaches') {
      payload.cap_breaches = bundle.cap_breaches;
    }

    return jsonOk(payload);
  } catch (error) {
    console.error('[api/reports]', error);
    return jsonError('Could not generate reports.', 500);
  }
}

import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getReportBundle } from '@/lib/queries';
import { ReportsClient } from '@/components/reports/reports-client';

export const metadata: Metadata = {
  title: 'Reports',
  description:
    'Live SQL reports for scope breakdown, compliance, top emitters and cap breaches.',
};

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = await requireSession();
  const departmentId = session.role === 'dept_lead' ? session.deptId : null;
  const scopeLabel =
    session.role === 'auditor'
      ? 'All departments'
      : `${session.deptName ?? 'Your department'} only`;

  const bundle = await getReportBundle(departmentId, scopeLabel, 1000);

  return <ReportsClient session={session} bundle={bundle} />;
}

import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getDashboardData } from '@/lib/queries';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Live carbon compliance overview across departments and scopes.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireSession();
  const departmentId = session.role === 'dept_lead' ? session.deptId : null;
  const data = await getDashboardData(departmentId);

  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date());

  return (
    <DashboardClient
      session={session}
      data={data}
      dateLabel={dateLabel}
    />
  );
}

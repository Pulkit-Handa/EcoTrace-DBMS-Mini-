'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Leaf,
  Plus,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';
import { EmissionsChart } from '@/components/dashboard/emissions-chart';
import { AddEmissionForm } from '@/components/dashboard/add-emission-form';
import { ComplianceBadge, ScopeBadge } from '@/components/ui/status-badge';
import { MetricCard } from '@/components/ui/metric-card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  cn,
  formatDate,
  formatDecimal,
  formatKg,
  formatNumber,
  percent,
  scopeDescription,
} from '@/lib/format';
import type { DashboardData, SessionUser } from '@/lib/types';

export function DashboardClient({
  session,
  data,
  dateLabel,
}: {
  session: SessionUser;
  data: DashboardData;
  dateLabel: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    breached: boolean;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totals = useMemo(() => {
    const emissions = data.compliance.reduce(
      (sum, row) => sum + Number(row.ytd_emissions),
      0,
    );
    const cap = data.compliance.reduce(
      (sum, row) => sum + Number(row.emission_cap),
      0,
    );
    const compliant = data.compliance.filter(
      (row) => row.status === 'Compliant',
    ).length;
    const scopeTotals = data.scopeBreakdown.reduce(
      (accumulator, row) => ({
        scope1: accumulator.scope1 + Number(row.scope1),
        scope2: accumulator.scope2 + Number(row.scope2),
        scope3: accumulator.scope3 + Number(row.scope3),
      }),
      { scope1: 0, scope2: 0, scope3: 0 },
    );
    const scopeTotal = scopeTotals.scope1 + scopeTotals.scope2 + scopeTotals.scope3;

    return {
      emissions,
      cap,
      compliant,
      remaining: Math.max(cap - emissions, 0),
      overage: Math.max(emissions - cap, 0),
      utilisation: cap ? Math.round((emissions / cap) * 100) : 0,
      scopeTotals,
      scopeTotal,
    };
  }, [data]);

  const firstName = session.name.split(' ')[0];
  const scopeText =
    session.role === 'auditor'
      ? 'All departments'
      : `${session.deptName ?? 'Your department'} only`;
  const attention = data.compliance.length - totals.compliant;

  const scopeSeries = [
    {
      key: 'scope1' as const,
      label: 'Scope 1',
      color: 'bg-brand-700',
      value: totals.scopeTotals.scope1,
    },
    {
      key: 'scope2' as const,
      label: 'Scope 2',
      color: 'bg-brand-400',
      value: totals.scopeTotals.scope2,
    },
    {
      key: 'scope3' as const,
      label: 'Scope 3',
      color: 'bg-amber-400',
      value: totals.scopeTotals.scope3,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">{dateLabel} · Compliance overview</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.35rem]">
            Welcome back, {firstName}.
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="badge border-brand-200 bg-brand-50 text-brand-800">
              <Building2 className="h-3.5 w-3.5" />
              {scopeText}
            </span>
            <span className="badge border-ink-200 bg-white text-ink-500">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Live PostgreSQL view
            </span>
            <span className="badge border-ink-200 bg-white text-ink-500">
              GHG Protocol · YTD
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/reports" className="btn-secondary">
            <BarChart3 className="h-4 w-4" />
            View reports
          </Link>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Log emission
          </button>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="YTD emissions"
          value={formatNumber(totals.emissions)}
          suffix="kg CO2e"
          helper={`${totals.utilisation}% of the combined annual cap is used.`}
          icon={Leaf}
          accent="brand"
          progress={totals.utilisation}
        />
        <MetricCard
          label="Annual cap"
          value={formatNumber(totals.cap)}
          suffix="kg CO2e"
          helper={
            totals.overage > 0
              ? `${formatNumber(totals.overage)} kg over the combined cap.`
              : `${formatNumber(totals.remaining)} kg of headroom remains.`
          }
          icon={Gauge}
          accent={totals.overage > 0 ? 'amber' : 'sky'}
          progress={totals.utilisation}
        />
        <MetricCard
          label="Compliance"
          value={`${totals.compliant}/${data.compliance.length}`}
          suffix="departments"
          helper={
            attention === 0
              ? 'Every visible department is within its cap.'
              : `${attention} department${attention === 1 ? '' : 's'} need attention.`
          }
          icon={ShieldCheck}
          accent={attention === 0 ? 'brand' : 'amber'}
        />
        <MetricCard
          label="Carbon credits"
          value={formatNumber(data.credits.bought + data.credits.offset)}
          suffix="credits"
          helper={`Bought ${formatNumber(data.credits.bought)} · offset ${formatNumber(
            data.credits.offset,
          )} across ${data.credits.transactions} transactions.`}
          icon={CircleDollarSign}
          accent="violet"
        />
      </section>

      {/* Chart + compliance */}
      <section className="grid gap-5 xl:grid-cols-12">
        <div className="card xl:col-span-8">
          <div className="flex flex-col gap-3 border-b border-ink-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">
                Emissions by department & scope
              </h2>
              <p className="mt-1 text-xs leading-5 text-ink-500">
                Year-to-date activity. Dashed line marks each department&apos;s
                annual cap.
              </p>
            </div>
            <Link
              href="/reports"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
            >
              Full analysis
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-2 pb-4 pt-4 sm:px-4">
            <EmissionsChart data={data.scopeBreakdown} />
          </div>
        </div>

        <div className="card flex flex-col xl:col-span-4">
          <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-5">
            <div>
              <h2 className="text-[15px] font-semibold">Cap status</h2>
              <p className="mt-1 text-xs leading-5 text-ink-500">
                Department-level year-to-date compliance.
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-brand-600" />
          </div>
          <div className="flex-1 space-y-4 px-5 py-5">
            {data.compliance.length === 0 ? (
              <p className="text-sm text-ink-500">
                No departments available for this scope.
              </p>
            ) : (
              data.compliance.map((row) => {
                const value = Math.min(100, row.utilisation_pct);
                const compliant = row.status === 'Compliant';
                return (
                  <div key={row.dept_id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-ink-800">
                        {row.department}
                      </span>
                      <ComplianceBadge status={row.status} />
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          compliant ? 'bg-brand-500' : 'bg-red-500',
                        )}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
                      <span className="text-ink-500">
                        {formatNumber(row.ytd_emissions)} / {formatNumber(row.emission_cap)} kg
                      </span>
                      <span
                        className={cn(
                          'font-semibold',
                          compliant ? 'text-brand-700' : 'text-red-600',
                        )}
                      >
                        {formatDecimal(row.utilisation_pct)}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="border-t border-ink-100 bg-ink-50/50 px-5 py-3.5">
            <p className="flex items-center gap-2 text-[10.5px] leading-4 text-ink-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" />
              Source: <span className="font-mono">compliance_summary</span> SQL view
            </p>
          </div>
        </div>
      </section>

      {/* Recent + scope mix */}
      <section className="grid gap-5 xl:grid-cols-12">
        <div className="card overflow-hidden xl:col-span-8">
          <div className="flex flex-col gap-2 border-b border-ink-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">Recent emission activity</h2>
              <p className="mt-1 text-xs leading-5 text-ink-500">
                Latest records joined to departments and users.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add record
            </button>
          </div>

          {data.recent.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Leaf className="h-5 w-5" />}
                title="No emission records yet"
                description="Log the first activity record to populate the compliance view."
                action={
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4" />
                    Log emission
                  </button>
                }
              />
            </div>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Department</th>
                    <th>Scope</th>
                    <th>Activity</th>
                    <th>Logged by</th>
                    <th className="text-right">Emissions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((record) => (
                    <tr key={record.record_id}>
                      <td className="whitespace-nowrap text-[12px] text-ink-500">
                        {formatDate(record.recorded_at)}
                      </td>
                      <td className="whitespace-nowrap text-[12.5px] font-medium text-ink-800">
                        {record.department}
                      </td>
                      <td>
                        <ScopeBadge scope={record.scope} />
                      </td>
                      <td className="max-w-[230px]">
                        <span className="block truncate text-[12px] text-ink-600">
                          {record.description ?? 'No description'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-ink-500">
                        {record.user_name}
                      </td>
                      <td className="whitespace-nowrap text-right text-[12.5px] font-semibold tabular-nums text-ink-900">
                        {formatKg(record.value_kgco2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card flex flex-col xl:col-span-4">
          <div className="border-b border-ink-100 px-5 py-5">
            <h2 className="text-[15px] font-semibold">Scope mix</h2>
            <p className="mt-1 text-xs leading-5 text-ink-500">
              Where the footprint comes from across the value chain.
            </p>
          </div>
          <div className="flex-1 px-5 py-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[2rem] font-semibold tracking-tight text-ink-950">
                {formatNumber(totals.scopeTotal)}
              </span>
              <span className="text-[11px] font-medium text-ink-400">kg CO2e</span>
            </div>
            <div className="mt-5 space-y-4">
              {scopeSeries.map((scope) => {
                const share = percent(scope.value, totals.scopeTotal);
                return (
                  <div key={scope.key}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-2 font-medium text-ink-700">
                        <span className={cn('h-2 w-2 rounded-full', scope.color)} />
                        {scope.label}
                      </span>
                      <span className="font-semibold tabular-nums text-ink-800">
                        {formatNumber(scope.value)} kg · {share}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={cn('h-full rounded-full', scope.color)}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-ink-400">
                      {scopeDescription(Number(scope.key.slice(-1)))}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="border-t border-ink-100 px-5 py-3.5">
            <Link
              href="/reports"
              className="flex items-center justify-between text-[11px] font-semibold text-brand-700 hover:text-brand-800"
            >
              Open scope breakdown report
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {formOpen ? (
        <AddEmissionForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          session={session}
          departments={data.departments}
          onSuccess={(message, breached) => {
            setToast({ message, breached });
            router.refresh();
          }}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'toast-in fixed bottom-5 right-5 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border bg-white p-4 shadow-2xl',
            toast.breached
              ? 'border-amber-200 ring-1 ring-amber-100'
              : 'border-brand-200 ring-1 ring-brand-100',
          )}
        >
          <span
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              toast.breached
                ? 'bg-amber-50 text-amber-700'
                : 'bg-brand-50 text-brand-700',
            )}
          >
            {toast.breached ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-ink-900">
              {toast.breached ? 'Cap breach detected' : 'Record saved'}
            </p>
            <p className="mt-1 text-[11.5px] leading-5 text-ink-500">
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10.5px] text-ink-400">
        <span className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5" />
          Scope 1–3 aligned
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          {session.role === 'auditor'
            ? 'Auditor sees all departments'
            : 'Role-scoped department view'}
        </span>
      </p>
    </div>
  );
}

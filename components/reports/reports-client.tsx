'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Database,
  Download,
  FileBarChart,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Badge, ComplianceBadge, ScopeBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { downloadCsv } from '@/lib/csv';
import {
  cn,
  formatDate,
  formatDecimal,
  formatKg,
  formatNumber,
  percent,
} from '@/lib/format';
import type { ReportBundle, SessionUser } from '@/lib/types';

type TabId = 'scope' | 'compliance' | 'top' | 'breaches';

const sqlSnippets: Record<TabId, string> = {
  scope: `SELECT dept_id, department, scope, record_count,
       avg_emission_kg, total_emission_kg
  FROM dept_scope_summary
 WHERE ($1::int IS NULL OR dept_id = $1)
 ORDER BY total_emission_kg DESC;

-- view definition
CREATE VIEW dept_scope_summary AS
SELECT d.dept_id, d.name AS department, e.scope,
       COUNT(*) AS record_count,
       ROUND(AVG(e.value_kgco2), 2) AS avg_emission_kg,
       SUM(e.value_kgco2) AS total_emission_kg
  FROM emission_records e
  JOIN departments d ON d.dept_id = e.dept_id
 WHERE e.recorded_at >= date_trunc('year', CURRENT_DATE)
 GROUP BY d.dept_id, d.name, e.scope
HAVING SUM(e.value_kgco2) > 0;`,
  compliance: `SELECT department, emission_cap, ytd_emissions,
       remaining_kg, utilisation_pct, status
  FROM compliance_summary
 WHERE ($1::int IS NULL OR dept_id = $1)
 ORDER BY utilisation_pct DESC;

-- view definition
CREATE VIEW compliance_summary AS
SELECT d.dept_id, d.name AS department,
       d.emission_cap,
       COALESCE(SUM(e.value_kgco2), 0) AS ytd_emissions,
       CASE WHEN COALESCE(SUM(e.value_kgco2), 0) > d.emission_cap
            THEN 'Non-Compliant' ELSE 'Compliant' END AS status
  FROM departments d
  LEFT JOIN emission_records e
    ON e.dept_id = d.dept_id
   AND e.recorded_at >= date_trunc('year', CURRENT_DATE)
 GROUP BY d.dept_id, d.name, d.emission_cap;`,
  top: `SELECT d.name AS department,
       SUM(e.value_kgco2) AS total_emission_kg,
       COUNT(*) AS records
  FROM emission_records e
  JOIN departments d ON d.dept_id = e.dept_id
 WHERE e.recorded_at >= date_trunc('year', CURRENT_DATE)
   AND ($1::int IS NULL OR d.dept_id = $1)
 GROUP BY d.dept_id, d.name
HAVING SUM(e.value_kgco2) >= $2
 ORDER BY total_emission_kg DESC
 LIMIT 6;`,
  breaches: `SELECT d.name AS department,
       d.emission_cap,
       t.total AS ytd_emissions,
       (t.total - d.emission_cap) AS overage_kg
  FROM departments d
  JOIN (
       SELECT dept_id, SUM(value_kgco2) AS total
         FROM emission_records
        WHERE recorded_at >= date_trunc('year', CURRENT_DATE)
        GROUP BY dept_id
  ) t ON t.dept_id = d.dept_id
 WHERE d.dept_id IN (
       SELECT e.dept_id
         FROM emission_records e
        WHERE e.recorded_at >= date_trunc('year', CURRENT_DATE)
        GROUP BY e.dept_id
       HAVING SUM(e.value_kgco2) > (
              SELECT dx.emission_cap
                FROM departments dx
               WHERE dx.dept_id = e.dept_id
       )
 )
 AND ($1::int IS NULL OR d.dept_id = $1)
 ORDER BY overage_kg DESC;`,
};

const tabConcepts: Record<TabId, string[]> = {
  scope: ['VIEW', 'JOIN', 'GROUP BY', 'HAVING', 'AVG'],
  compliance: ['VIEW', 'LEFT JOIN', 'COALESCE', 'CASE'],
  top: ['GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT'],
  breaches: ['SUBQUERY', 'IN', 'HAVING', 'CORRELATED'],
};

export function ReportsClient({
  session,
  bundle,
}: {
  session: SessionUser;
  bundle: ReportBundle;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('scope');
  const [pending, startTransition] = useTransition();

  const summary = useMemo(() => {
    const emissions = bundle.compliance.reduce(
      (total, row) => total + row.ytd_emissions,
      0,
    );
    const compliant = bundle.compliance.filter(
      (row) => row.status === 'Compliant',
    ).length;
    return {
      emissions,
      compliant,
      breaches: bundle.cap_breaches.length,
      departments: bundle.compliance.length,
    };
  }, [bundle]);

  const tabs: Array<{
    id: TabId;
    label: string;
    count: number;
    icon: typeof Layers;
  }> = [
    {
      id: 'scope',
      label: 'Scope breakdown',
      count: bundle.scope_breakdown.length,
      icon: Layers,
    },
    {
      id: 'compliance',
      label: 'Compliance',
      count: bundle.compliance.length,
      icon: ShieldCheck,
    },
    {
      id: 'top',
      label: 'Top emitters',
      count: bundle.top_emitters.length,
      icon: TrendingUp,
    },
    {
      id: 'breaches',
      label: 'Cap breaches',
      count: bundle.cap_breaches.length,
      icon: AlertTriangle,
    },
  ];

  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0];

  const handleDownload = () => {
    const date = new Date().toISOString().slice(0, 10);
    if (tab === 'scope') {
      downloadCsv(
        `ecotrace-scope-${date}.csv`,
        ['Department', 'Scope', 'Records', 'Average kg CO2e', 'Total kg CO2e'],
        bundle.scope_breakdown.map((row) => [
          row.department,
          `Scope ${row.scope}`,
          row.record_count,
          row.avg_emission_kg,
          row.total_emission_kg,
        ]),
      );
      return;
    }

    if (tab === 'compliance') {
      downloadCsv(
        `ecotrace-compliance-${date}.csv`,
        [
          'Department',
          'YTD emissions (kg)',
          'Cap (kg)',
          'Remaining (kg)',
          'Utilisation (%)',
          'Status',
        ],
        bundle.compliance.map((row) => [
          row.department,
          row.ytd_emissions,
          row.emission_cap,
          row.remaining_kg,
          row.utilisation_pct,
          row.status,
        ]),
      );
      return;
    }

    if (tab === 'top') {
      downloadCsv(
        `ecotrace-top-emitters-${date}.csv`,
        ['Department', 'Total kg CO2e', 'Records'],
        bundle.top_emitters.map((row) => [
          row.department,
          row.total_emission_kg,
          row.records,
        ]),
      );
      return;
    }

    downloadCsv(
      `ecotrace-breach-report-${date}.csv`,
      ['Department', 'Cap (kg)', 'YTD emissions (kg)', 'Overage (kg)'],
      bundle.cap_breaches.map((row) => [
        row.department,
        row.emission_cap,
        row.ytd_emissions,
        row.overage_kg,
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">Analytics · PostgreSQL</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.35rem]">
            Reports & SQL insights
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
            Four live reports built on views, joins, aggregates and subqueries.
            Every figure below is generated from the relational schema at request
            time.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="badge border-brand-200 bg-brand-50 text-brand-800">
              <Building2 className="h-3.5 w-3.5" />
              {bundle.scope_label}
            </span>
            <span className="badge border-ink-200 bg-white text-ink-500">
              <Database className="h-3.5 w-3.5" />
              5 tables · 3 views
            </span>
            <span className="badge border-ink-200 bg-white text-ink-500">
              Snapshot {formatDate(bundle.generated_at, true)} UTC
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              startTransition(() => {
                router.refresh();
              })
            }
            disabled={pending}
            className="btn-secondary"
          >
            <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} />
            {pending ? 'Refreshing…' : 'Refresh data'}
          </button>
          <button type="button" onClick={handleDownload} className="btn-primary">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Reported emissions"
          value={formatNumber(summary.emissions)}
          suffix="kg CO2e"
          helper="Year-to-date across visible departments."
          icon={BarChart3}
          accent="brand"
        />
        <MetricCard
          label="Compliant"
          value={`${summary.compliant}/${summary.departments}`}
          suffix="departments"
          helper="Based on the compliance_summary view."
          icon={CheckCircle2}
          accent={summary.compliant === summary.departments ? 'brand' : 'amber'}
        />
        <MetricCard
          label="Top-emitter threshold"
          value={formatNumber(bundle.threshold)}
          suffix="kg"
          helper="HAVING filter used by the ranking report."
          icon={Target}
          accent="sky"
        />
        <MetricCard
          label="Cap breaches"
          value={String(summary.breaches)}
          suffix="departments"
          helper="Detected with a correlated IN subquery."
          icon={AlertTriangle}
          accent={summary.breaches > 0 ? 'amber' : 'brand'}
        />
      </section>

      <section className="card overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto border-b border-ink-100 px-3 pt-3">
          <div className="flex min-w-max gap-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = item.id === tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-t-xl px-3.5 py-3 text-[12px] font-semibold transition',
                    active
                      ? 'bg-brand-50/80 text-brand-800'
                      : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px]',
                      active
                        ? 'bg-brand-200/70 text-brand-800'
                        : 'bg-ink-100 text-ink-500',
                    )}
                  >
                    {item.count}
                  </span>
                  {active ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-ink-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold">{activeTab.label}</h2>
              {tabConcepts[tab].map((concept) => (
                <Badge key={concept} tone="neutral" className="font-mono text-[9.5px]">
                  {concept}
                </Badge>
              ))}
            </div>
            <p className="mt-1.5 text-xs leading-5 text-ink-500">
              {tab === 'scope' &&
                'Average and total emissions per department per GHG scope, from the dept_scope_summary view.'}
              {tab === 'compliance' &&
                'Cap utilisation and compliance status, calculated with COALESCE and CASE.'}
              {tab === 'top' &&
                `Departments whose YTD total is at least ${formatNumber(bundle.threshold)} kg, ranked with HAVING and ORDER BY.`}
              {tab === 'breaches' &&
                'Departments whose YTD emissions exceed their own cap, found through a correlated IN subquery.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="btn-ghost shrink-0 self-start text-[11px] sm:self-auto"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>

        <div className="scrollbar-thin overflow-x-auto">
          {tab === 'scope' ? (
            bundle.scope_breakdown.length > 0 ? (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Scope</th>
                    <th className="text-right">Records</th>
                    <th className="text-right">Average</th>
                    <th className="text-right">Total emissions</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.scope_breakdown.map((row) => {
                    const total = bundle.scope_breakdown.reduce(
                      (sum, item) => sum + item.total_emission_kg,
                      0,
                    );
                    const share = percent(row.total_emission_kg, total);
                    return (
                      <tr key={`${row.dept_id}-${row.scope}`}>
                        <td className="whitespace-nowrap font-medium text-ink-800">
                          {row.department}
                        </td>
                        <td>
                          <ScopeBadge scope={row.scope} />
                        </td>
                        <td className="text-right tabular-nums">
                          {row.record_count}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatKg(row.avg_emission_kg)}
                        </td>
                        <td className="text-right font-semibold tabular-nums text-ink-900">
                          {formatKg(row.total_emission_kg)}
                        </td>
                        <td className="w-40">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="text-[10.5px] tabular-nums text-ink-500">
                              {share}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={<Layers className="h-5 w-5" />}
                  title="No scope records"
                  description="No year-to-date emission records exist for this scope."
                />
              </div>
            )
          ) : null}

          {tab === 'compliance' ? (
            bundle.compliance.length > 0 ? (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th className="text-right">YTD emissions</th>
                    <th className="text-right">Annual cap</th>
                    <th>Utilisation</th>
                    <th className="text-right">Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.compliance.map((row) => {
                    const over = row.status === 'Non-Compliant';
                    return (
                      <tr key={row.dept_id}>
                        <td className="whitespace-nowrap font-medium text-ink-800">
                          {row.department}
                        </td>
                        <td className="text-right font-semibold tabular-nums text-ink-900">
                          {formatKg(row.ytd_emissions)}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatKg(row.emission_cap)}
                        </td>
                        <td className="w-44">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-ink-100">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  over ? 'bg-red-500' : 'bg-brand-500',
                                )}
                                style={{
                                  width: `${Math.min(100, row.utilisation_pct)}%`,
                                }}
                              />
                            </div>
                            <span
                              className={cn(
                                'text-[10.5px] font-semibold tabular-nums',
                                over ? 'text-red-600' : 'text-brand-700',
                              )}
                            >
                              {formatDecimal(row.utilisation_pct)}%
                            </span>
                          </div>
                        </td>
                        <td className="text-right tabular-nums">
                          {over ? (
                            <span className="text-red-600">—</span>
                          ) : (
                            formatKg(row.remaining_kg)
                          )}
                        </td>
                        <td>
                          <ComplianceBadge status={row.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="No compliance rows"
                  description="Departments will appear here once they are configured."
                />
              </div>
            )
          ) : null}

          {tab === 'top' ? (
            bundle.top_emitters.length > 0 ? (
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="w-14">Rank</th>
                    <th>Department</th>
                    <th className="text-right">Records</th>
                    <th className="text-right">YTD emissions</th>
                    <th>Relative volume</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.top_emitters.map((row, index) => {
                    const max = bundle.top_emitters[0]?.total_emission_kg || 1;
                    return (
                      <tr key={row.dept_id}>
                        <td>
                          <span
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold',
                              index === 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-ink-100 text-ink-500',
                            )}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="whitespace-nowrap font-medium text-ink-800">
                          {row.department}
                        </td>
                        <td className="text-right tabular-nums">{row.records}</td>
                        <td className="text-right font-semibold tabular-nums text-ink-900">
                          {formatKg(row.total_emission_kg)}
                        </td>
                        <td className="w-56">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-36 overflow-hidden rounded-full bg-ink-100">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                                style={{
                                  width: `${percent(
                                    row.total_emission_kg,
                                    max,
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10.5px] tabular-nums text-ink-500">
                              {percent(row.total_emission_kg, max)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={<TrendingUp className="h-5 w-5" />}
                  title="No departments above threshold"
                  description={`No department has reported at least ${formatNumber(
                    bundle.threshold,
                  )} kg this year. Lower the threshold in the API query to widen the report.`}
                />
              </div>
            )
          ) : null}

          {tab === 'breaches' ? (
            bundle.cap_breaches.length > 0 ? (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th className="text-right">Annual cap</th>
                    <th className="text-right">YTD emissions</th>
                    <th className="text-right">Overage</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.cap_breaches.map((row) => {
                    const severity =
                      row.overage_kg > 1000
                        ? 'Critical'
                        : row.overage_kg > 300
                          ? 'High'
                          : 'Moderate';
                    return (
                      <tr key={row.dept_id}>
                        <td className="whitespace-nowrap font-medium text-ink-800">
                          {row.department}
                        </td>
                        <td className="text-right tabular-nums">
                          {formatKg(row.emission_cap)}
                        </td>
                        <td className="text-right font-semibold tabular-nums text-ink-900">
                          {formatKg(row.ytd_emissions)}
                        </td>
                        <td className="text-right font-semibold tabular-nums text-red-600">
                          +{formatKg(row.overage_kg)}
                        </td>
                        <td>
                          <Badge tone={severity === 'Critical' ? 'danger' : 'warning'}>
                            <AlertTriangle className="h-3 w-3" />
                            {severity}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  title="No cap breaches"
                  description="Every department is currently within its annual emission cap."
                />
              </div>
            )
          ) : null}
        </div>

        <div className="border-t border-ink-100 bg-ink-50/60">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-[11px] font-semibold text-ink-600 transition hover:text-ink-900">
              <FileBarChart className="h-3.5 w-3.5" />
              View SQL executed for this report
              <span className="ml-auto text-[10px] font-normal text-ink-400 group-open:hidden">
                Expand
              </span>
            </summary>
            <pre className="scrollbar-thin max-h-[360px] overflow-auto border-t border-ink-200/70 bg-ink-950 px-5 py-4 text-[10.5px] leading-5 text-brand-100/85">
              <code>{sqlSnippets[tab]}</code>
            </pre>
          </details>
        </div>
      </section>

      <div className="flex flex-col gap-2 rounded-2xl border border-ink-200/80 bg-white px-5 py-4 text-[11px] leading-5 text-ink-500 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <Database className="h-4 w-4 text-brand-600" />
          Reports run against PostgreSQL 17 · role scope:{' '}
          <span className="font-medium text-ink-700">
            {session.role === 'auditor' ? 'all departments' : session.deptName}
          </span>
        </span>
        <span className="font-mono text-[10px] text-ink-400">
          dept_scope_summary · compliance_summary · carbon_credits
        </span>
      </div>
    </div>
  );
}

import { one, query } from './postgres';
import type {
  CapBreachRow,
  ComplianceRow,
  CreditTotals,
  DashboardData,
  Department,
  RecentEmission,
  ReportBundle,
  ScopeBreakdownRow,
  ScopeSummaryRow,
  TopEmitterRow,
  VectorMatch,
} from './types';

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export async function getDepartments(): Promise<Department[]> {
  return query<Department>(
    `SELECT dept_id, name, emission_cap::float8 AS emission_cap
       FROM departments
      ORDER BY name ASC`,
  );
}

export async function getComplianceSummary(
  departmentId: number | null = null,
): Promise<ComplianceRow[]> {
  return query<ComplianceRow>(
    `SELECT dept_id, department, emission_cap, ytd_emissions,
            remaining_kg, utilisation_pct, status
       FROM compliance_summary
      WHERE ($1::int IS NULL OR dept_id = $1)
      ORDER BY utilisation_pct DESC, department ASC`,
    [departmentId],
  );
}

export async function getComplianceForDepartment(
  departmentId: number,
): Promise<ComplianceRow | null> {
  return one<ComplianceRow>(
    `SELECT dept_id, department, emission_cap, ytd_emissions,
            remaining_kg, utilisation_pct, status
       FROM compliance_summary
      WHERE dept_id = $1`,
    [departmentId],
  );
}

export async function getScopeBreakdown(
  departmentId: number | null = null,
): Promise<ScopeBreakdownRow[]> {
  return query<ScopeBreakdownRow>(
    `SELECT d.dept_id,
            d.name AS department,
            d.emission_cap::float8 AS cap,
            COALESCE(SUM(CASE WHEN e.scope = 1 THEN e.value_kgco2 END), 0)::float8 AS scope1,
            COALESCE(SUM(CASE WHEN e.scope = 2 THEN e.value_kgco2 END), 0)::float8 AS scope2,
            COALESCE(SUM(CASE WHEN e.scope = 3 THEN e.value_kgco2 END), 0)::float8 AS scope3
       FROM departments d
       LEFT JOIN emission_records e
              ON e.dept_id = d.dept_id
             AND e.recorded_at >= date_trunc('year', CURRENT_DATE)
      WHERE ($1::int IS NULL OR d.dept_id = $1)
      GROUP BY d.dept_id, d.name, d.emission_cap
      ORDER BY d.name ASC`,
    [departmentId],
  );
}

type RecentEmissionRow = Omit<RecentEmission, 'recorded_at'> & {
  recorded_at: Date | string;
};

export async function getRecentEmissions(
  departmentId: number | null = null,
  limit = 8,
): Promise<RecentEmission[]> {
  const rows = await query<RecentEmissionRow>(
    `SELECT e.record_id,
            d.name AS department,
            u.name AS user_name,
            e.scope,
            e.value_kgco2::float8 AS value_kgco2,
            e.description,
            e.recorded_at
       FROM emission_records e
       JOIN departments d ON d.dept_id = e.dept_id
       JOIN users u ON u.user_id = e.user_id
      WHERE ($1::int IS NULL OR e.dept_id = $1)
      ORDER BY e.recorded_at DESC, e.record_id DESC
      LIMIT $2`,
    [departmentId, limit],
  );

  return rows.map((row) => ({
    ...row,
    recorded_at:
      row.recorded_at instanceof Date
        ? row.recorded_at.toISOString()
        : row.recorded_at,
  }));
}

export async function getEmissionRecords(options: {
  departmentId?: number | null;
  scope?: number | null;
  limit?: number;
}): Promise<RecentEmission[]> {
  const { departmentId = null, scope = null, limit = 25 } = options;
  const rows = await query<RecentEmissionRow>(
    `SELECT e.record_id,
            d.name AS department,
            u.name AS user_name,
            e.scope,
            e.value_kgco2::float8 AS value_kgco2,
            e.description,
            e.recorded_at
       FROM emission_records e
       JOIN departments d ON d.dept_id = e.dept_id
       JOIN users u ON u.user_id = e.user_id
      WHERE ($1::int IS NULL OR e.dept_id = $1)
        AND ($2::int IS NULL OR e.scope = $2)
      ORDER BY e.recorded_at DESC, e.record_id DESC
      LIMIT $3`,
    [departmentId, scope, limit],
  );

  return rows.map((row) => ({
    ...row,
    recorded_at:
      row.recorded_at instanceof Date
        ? row.recorded_at.toISOString()
        : row.recorded_at,
  }));
}

export async function getCreditTotals(
  departmentId: number | null = null,
): Promise<CreditTotals> {
  const row = await one<CreditTotals>(
    `SELECT COUNT(*)::int AS transactions,
            COALESCE(SUM(CASE WHEN txn_type = 'buy' THEN quantity ELSE 0 END), 0)::float8 AS bought,
            COALESCE(SUM(CASE WHEN txn_type = 'sell' THEN quantity ELSE 0 END), 0)::float8 AS sold,
            COALESCE(SUM(CASE WHEN txn_type = 'offset' THEN quantity ELSE 0 END), 0)::float8 AS offset
       FROM carbon_credits
      WHERE ($1::int IS NULL OR dept_id = $1)`,
    [departmentId],
  );

  return row ?? { transactions: 0, bought: 0, sold: 0, offset: 0 };
}

export async function getDashboardData(
  departmentId: number | null,
): Promise<DashboardData> {
  const [compliance, scopeBreakdown, recent, credits, departments] =
    await Promise.all([
      getComplianceSummary(departmentId),
      getScopeBreakdown(departmentId),
      getRecentEmissions(departmentId, 8),
      getCreditTotals(departmentId),
      getDepartments(),
    ]);

  return {
    compliance,
    scopeBreakdown,
    recent,
    credits,
    departments,
  };
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

export async function getScopeSummary(
  departmentId: number | null = null,
): Promise<ScopeSummaryRow[]> {
  return query<ScopeSummaryRow>(
    `SELECT dept_id, department, scope, record_count,
            avg_emission_kg, total_emission_kg
       FROM dept_scope_summary
      WHERE ($1::int IS NULL OR dept_id = $1)
      ORDER BY total_emission_kg DESC, department ASC, scope ASC`,
    [departmentId],
  );
}

export async function getTopEmitters(
  departmentId: number | null,
  threshold: number,
): Promise<TopEmitterRow[]> {
  return query<TopEmitterRow>(
    `SELECT d.dept_id,
            d.name AS department,
            SUM(e.value_kgco2)::float8 AS total_emission_kg,
            COUNT(*)::int AS records
       FROM emission_records e
       JOIN departments d ON d.dept_id = e.dept_id
      WHERE e.recorded_at >= date_trunc('year', CURRENT_DATE)
        AND ($1::int IS NULL OR d.dept_id = $1)
      GROUP BY d.dept_id, d.name
     HAVING SUM(e.value_kgco2) >= $2
      ORDER BY total_emission_kg DESC
      LIMIT 6`,
    [departmentId, threshold],
  );
}

export async function getCapBreaches(
  departmentId: number | null = null,
): Promise<CapBreachRow[]> {
  return query<CapBreachRow>(
    `SELECT d.dept_id,
            d.name AS department,
            d.emission_cap::float8 AS emission_cap,
            t.total::float8 AS ytd_emissions,
            (t.total - d.emission_cap)::float8 AS overage_kg
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
      ORDER BY overage_kg DESC`,
    [departmentId],
  );
}

export async function getReportBundle(
  departmentId: number | null,
  scopeLabel: string,
  threshold = 1000,
): Promise<ReportBundle> {
  const [scopeBreakdown, compliance, topEmitters, capBreaches] =
    await Promise.all([
      getScopeSummary(departmentId),
      getComplianceSummary(departmentId),
      getTopEmitters(departmentId, threshold),
      getCapBreaches(departmentId),
    ]);

  return {
    generated_at: new Date().toISOString(),
    scope_label: scopeLabel,
    threshold,
    scope_breakdown: scopeBreakdown,
    compliance,
    top_emitters: topEmitters,
    cap_breaches: capBreaches,
  };
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function createEmission(input: {
  departmentId: number;
  userId: number;
  scope: number;
  valueKgco2: number;
  description: string | null;
}): Promise<{ record_id: number; recorded_at: string }> {
  const row = await one<{ record_id: number; recorded_at: Date }>(
    `INSERT INTO emission_records
        (dept_id, user_id, scope, value_kgco2, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING record_id, recorded_at`,
    [
      input.departmentId,
      input.userId,
      input.scope,
      input.valueKgco2,
      input.description,
    ],
  );

  if (!row) throw new Error('Emission insert returned no row');

  return {
    record_id: row.record_id,
    recorded_at: row.recorded_at.toISOString(),
  };
}

export async function insertVendorReportLink(input: {
  vendorName: string;
  departmentId: number;
  mongoDocId: string;
}): Promise<number> {
  const row = await one<{ report_id: number }>(
    `INSERT INTO vendor_reports (vendor_name, dept_id, mongo_doc_id)
     VALUES ($1, $2, $3)
     RETURNING report_id`,
    [input.vendorName, input.departmentId, input.mongoDocId],
  );

  if (!row) throw new Error('Vendor report insert returned no row');
  return row.report_id;
}

export async function attachVendorEmbedding(
  reportId: number,
  vectorLiteral: string,
): Promise<void> {
  await query(
    `UPDATE vendor_reports
        SET embedding = $1::vector
      WHERE report_id = $2`,
    [vectorLiteral, reportId],
  );
}

export async function isVectorReady(): Promise<boolean> {
  try {
    const row = await one<{ ready: boolean }>(
      `SELECT (
                EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
            AND EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'vendor_reports'
                       AND column_name = 'embedding'
                )
              ) AS ready`,
    );
    return Boolean(row?.ready);
  } catch {
    return false;
  }
}

export async function vectorSearchVendorReports(input: {
  vectorLiteral: string;
  departmentId: number | null;
  limit: number;
}): Promise<VectorMatch[]> {
  return query<VectorMatch>(
    `SELECT report_id,
            mongo_doc_id,
            vendor_name,
            dept_id,
            ROUND((1 - (embedding <=> $1::vector))::numeric, 4)::float8 AS similarity
       FROM vendor_reports
      WHERE embedding IS NOT NULL
        AND ($2::int IS NULL OR dept_id = $2)
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
    [input.vectorLiteral, input.departmentId, input.limit],
  );
}

/* -------------------------------------------------------------------------- */
/* Health / diagnostics                                                       */
/* -------------------------------------------------------------------------- */

export async function getDatabaseHealth(): Promise<{
  connected: boolean;
  version?: string;
  vectorReady?: boolean;
  tables?: number;
  error?: string;
}> {
  try {
    const row = await one<{
      version: string;
      tables: number;
      vector_ready: boolean;
    }>(
      `SELECT version() AS version,
              (SELECT COUNT(*)::int
                 FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE') AS tables,
              (
                EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
                AND EXISTS (
                    SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public'
                       AND table_name = 'vendor_reports'
                       AND column_name = 'embedding'
                )
              ) AS vector_ready`,
    );

    return {
      connected: true,
      version: row?.version,
      tables: row?.tables,
      vectorReady: Boolean(row?.vector_ready),
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

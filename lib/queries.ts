import { one, query } from './mysql';
import { embedText } from './embeddings';
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
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (denominator === 0) return 0;
  return dot / denominator;
}

/**
 * Parse a JSON-stored embedding from MySQL into a number array.
 */
function parseEmbedding(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value as number[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      return null;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export async function getDepartments(): Promise<Department[]> {
  return query<Department>(
    `SELECT dept_id, name, CAST(emission_cap AS DECIMAL(12,2)) AS emission_cap
       FROM departments
      ORDER BY name ASC`,
  );
}

export async function getComplianceSummary(
  departmentId: number | null = null,
): Promise<ComplianceRow[]> {
  return query<ComplianceRow>(
    `SELECT
            d.dept_id,
            d.name AS department,
            CAST(d.emission_cap AS DECIMAL(12,2)) AS emission_cap,
            CAST(COALESCE(SUM(e.value_kgco2), 0) AS DECIMAL(12,2)) AS ytd_emissions,
            CAST(GREATEST(d.emission_cap - COALESCE(SUM(e.value_kgco2), 0), 0) AS DECIMAL(12,2)) AS remaining_kg,
            CAST(ROUND(
                COALESCE(SUM(e.value_kgco2), 0) / NULLIF(d.emission_cap, 0) * 100,
                1
            ) AS DECIMAL(5,2)) AS utilisation_pct,
            CASE
                WHEN COALESCE(SUM(e.value_kgco2), 0) > d.emission_cap THEN 'Non-Compliant'
                ELSE 'Compliant'
            END AS status
       FROM departments d
       LEFT JOIN emission_records e
              ON e.dept_id = d.dept_id
             AND e.recorded_at >= DATE_FORMAT(CURRENT_DATE, '%Y-01-01')
      WHERE (? IS NULL OR d.dept_id = ?)
      GROUP BY d.dept_id, d.name, d.emission_cap
      ORDER BY utilisation_pct DESC, department ASC`,
    [departmentId, departmentId],
  );
}

export async function getComplianceForDepartment(
  departmentId: number,
): Promise<ComplianceRow | null> {
  return one<ComplianceRow>(
    `SELECT
            d.dept_id,
            d.name AS department,
            CAST(d.emission_cap AS DECIMAL(12,2)) AS emission_cap,
            CAST(COALESCE(SUM(e.value_kgco2), 0) AS DECIMAL(12,2)) AS ytd_emissions,
            CAST(GREATEST(d.emission_cap - COALESCE(SUM(e.value_kgco2), 0), 0) AS DECIMAL(12,2)) AS remaining_kg,
            CAST(ROUND(
                COALESCE(SUM(e.value_kgco2), 0) / NULLIF(d.emission_cap, 0) * 100,
                1
            ) AS DECIMAL(5,2)) AS utilisation_pct,
            CASE
                WHEN COALESCE(SUM(e.value_kgco2), 0) > d.emission_cap THEN 'Non-Compliant'
                ELSE 'Compliant'
            END AS status
       FROM departments d
       LEFT JOIN emission_records e
              ON e.dept_id = d.dept_id
             AND e.recorded_at >= DATE_FORMAT(CURRENT_DATE, '%Y-01-01')
      WHERE d.dept_id = ?
      GROUP BY d.dept_id, d.name, d.emission_cap`,
    [departmentId],
  );
}

export async function getScopeBreakdown(
  departmentId: number | null = null,
): Promise<ScopeBreakdownRow[]> {
  return query<ScopeBreakdownRow>(
    `SELECT d.dept_id,
            d.name AS department,
            CAST(d.emission_cap AS DECIMAL(12,2)) AS cap,
            CAST(COALESCE(SUM(CASE WHEN e.scope = 1 THEN e.value_kgco2 END), 0) AS DECIMAL(12,2)) AS scope1,
            CAST(COALESCE(SUM(CASE WHEN e.scope = 2 THEN e.value_kgco2 END), 0) AS DECIMAL(12,2)) AS scope2,
            CAST(COALESCE(SUM(CASE WHEN e.scope = 3 THEN e.value_kgco2 END), 0) AS DECIMAL(12,2)) AS scope3
       FROM departments d
       LEFT JOIN emission_records e
              ON e.dept_id = d.dept_id
             AND e.recorded_at >= DATE_FORMAT(CURRENT_DATE, '%Y-01-01')
      WHERE (? IS NULL OR d.dept_id = ?)
      GROUP BY d.dept_id, d.name, d.emission_cap
      ORDER BY d.name ASC`,
    [departmentId, departmentId],
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
            CAST(e.value_kgco2 AS DECIMAL(12,2)) AS value_kgco2,
            e.description,
            e.recorded_at
       FROM emission_records e
       JOIN departments d ON d.dept_id = e.dept_id
       JOIN users u ON u.user_id = e.user_id
      WHERE (? IS NULL OR e.dept_id = ?)
      ORDER BY e.recorded_at DESC, e.record_id DESC
      LIMIT ?`,
    [departmentId, departmentId, limit],
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
            CAST(e.value_kgco2 AS DECIMAL(12,2)) AS value_kgco2,
            e.description,
            e.recorded_at
       FROM emission_records e
       JOIN departments d ON d.dept_id = e.dept_id
       JOIN users u ON u.user_id = e.user_id
      WHERE (? IS NULL OR e.dept_id = ?)
        AND (? IS NULL OR e.scope = ?)
      ORDER BY e.recorded_at DESC, e.record_id DESC
      LIMIT ?`,
    [departmentId, departmentId, scope, scope, limit],
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
    `SELECT COUNT(*) AS transactions,
            CAST(COALESCE(SUM(CASE WHEN txn_type = 'buy' THEN quantity ELSE 0 END), 0) AS DECIMAL(10,2)) AS bought,
            CAST(COALESCE(SUM(CASE WHEN txn_type = 'sell' THEN quantity ELSE 0 END), 0) AS DECIMAL(10,2)) AS sold,
            CAST(COALESCE(SUM(CASE WHEN txn_type = 'offset' THEN quantity ELSE 0 END), 0) AS DECIMAL(10,2)) AS offset
       FROM carbon_credits
      WHERE (? IS NULL OR dept_id = ?)`,
    [departmentId, departmentId],
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
    `SELECT
            d.dept_id,
            d.name AS department,
            e.scope,
            COUNT(*) AS record_count,
            CAST(ROUND(AVG(e.value_kgco2), 2) AS DECIMAL(12,2)) AS avg_emission_kg,
            CAST(SUM(e.value_kgco2) AS DECIMAL(12,2)) AS total_emission_kg
       FROM emission_records e
       JOIN departments d ON d.dept_id = e.dept_id
      WHERE e.recorded_at >= DATE_FORMAT(CURRENT_DATE, '%Y-01-01')
        AND (? IS NULL OR d.dept_id = ?)
      GROUP BY d.dept_id, d.name, e.scope
     HAVING SUM(e.value_kgco2) > 0
      ORDER BY total_emission_kg DESC, department ASC, scope ASC`,
    [departmentId, departmentId],
  );
}

export async function getTopEmitters(
  departmentId: number | null,
  threshold: number,
): Promise<TopEmitterRow[]> {
  return query<TopEmitterRow>(
    `SELECT d.dept_id,
            d.name AS department,
            CAST(SUM(e.value_kgco2) AS DECIMAL(12,2)) AS total_emission_kg,
            COUNT(*) AS records
       FROM emission_records e
       JOIN departments d ON d.dept_id = e.dept_id
      WHERE e.recorded_at >= DATE_FORMAT(CURRENT_DATE, '%Y-01-01')
        AND (? IS NULL OR d.dept_id = ?)
      GROUP BY d.dept_id, d.name
     HAVING SUM(e.value_kgco2) >= ?
      ORDER BY total_emission_kg DESC
      LIMIT 6`,
    [departmentId, departmentId, threshold],
  );
}

export async function getCapBreaches(
  departmentId: number | null = null,
): Promise<CapBreachRow[]> {
  return query<CapBreachRow>(
    `SELECT d.dept_id,
            d.name AS department,
            CAST(d.emission_cap AS DECIMAL(12,2)) AS emission_cap,
            CAST(t.total AS DECIMAL(12,2)) AS ytd_emissions,
            CAST((t.total - d.emission_cap) AS DECIMAL(12,2)) AS overage_kg
       FROM departments d
       JOIN (
            SELECT dept_id, SUM(value_kgco2) AS total
              FROM emission_records
             WHERE recorded_at >= DATE_FORMAT(CURRENT_DATE, '%Y-01-01')
             GROUP BY dept_id
       ) t ON t.dept_id = d.dept_id
      WHERE d.dept_id IN (
            SELECT e.dept_id
              FROM emission_records e
             WHERE e.recorded_at >= DATE_FORMAT(CURRENT_DATE, '%Y-01-01')
             GROUP BY e.dept_id
            HAVING SUM(e.value_kgco2) > (
                   SELECT dx.emission_cap
                     FROM departments dx
                    WHERE dx.dept_id = e.dept_id
             )
       )
        AND (? IS NULL OR d.dept_id = ?)
      ORDER BY overage_kg DESC`,
    [departmentId, departmentId],
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
     VALUES (?, ?, ?, ?, ?)`,
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
  const result = await query<{ insertId: number }>(
    `INSERT INTO vendor_reports (vendor_name, dept_id, mongo_doc_id)
     VALUES (?, ?, ?)`,
    [input.vendorName, input.departmentId, input.mongoDocId],
  );

  if (!result || result.length === 0) {
    throw new Error('Vendor report insert returned no row');
  }

  // mysql2 returns [rows] for INSERT with the insertId in the first row's meta.
  // We use SELECT LAST_INSERT_ID() as a portable fallback.
  const idRow = await one<{ insertId: number }>(
    'SELECT LAST_INSERT_ID() AS insertId',
  );
  const reportId = idRow?.insertId ?? Number(result[0]?.insertId ?? 0);
  return reportId;
}

export async function attachVendorEmbedding(
  reportId: number,
  vectorLiteral: string,
): Promise<void> {
  const embedding = JSON.parse(vectorLiteral);
  await query(
    `UPDATE vendor_reports
        SET embedding = ?
      WHERE report_id = ?`,
    [JSON.stringify(embedding), reportId],
  );
}

export async function isVectorReady(): Promise<boolean> {
  try {
    const row = await one<{ ready: number }>(
      `SELECT (
                EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = DATABASE()
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

/**
 * Application-side vector search.
 *
 * Fetches all embeddings from MySQL for the given department, computes
 * cosine similarity against the query vector in TypeScript, and returns
 * the top matches ranked by similarity.
 */
export async function vectorSearchVendorReports(input: {
  vectorLiteral: string;
  departmentId: number | null;
  limit: number;
}): Promise<VectorMatch[]> {
  const queryVector = JSON.parse(input.vectorLiteral);

  // Fetch all rows that have embeddings, optionally filtered by department.
  const rows = await query<{
    report_id: number;
    mongo_doc_id: string;
    vendor_name: string;
    dept_id: number;
    embedding: string;
  }>(
    `SELECT report_id, mongo_doc_id, vendor_name, dept_id, embedding
       FROM vendor_reports
      WHERE embedding IS NOT NULL AND embedding != ''
        AND (? IS NULL OR dept_id = ?)`,
    [input.departmentId, input.departmentId],
  );

  const scored: VectorMatch[] = [];
  for (const row of rows) {
    const storedVector = parseEmbedding(row.embedding);
    if (!storedVector) continue;

    const similarity = cosineSimilarity(queryVector, storedVector);
    scored.push({
      report_id: row.report_id,
      mongo_doc_id: row.mongo_doc_id,
      vendor_name: row.vendor_name,
      dept_id: row.dept_id,
      similarity: Math.round(similarity * 10000) / 10000,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, input.limit);
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
      vector_ready: number;
    }>(
      `SELECT VERSION() AS version,
              (SELECT COUNT(*)
                 FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_type = 'BASE TABLE') AS tables,
              (
                EXISTS (
                    SELECT 1
                      FROM information_schema.columns
                     WHERE table_schema = DATABASE()
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

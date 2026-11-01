/**
 * EcoTrace — quick database verification (MySQL + MongoDB).
 * Prints the relational objects, compliance view, row counts,
 * app-side vector state and MongoDB document count.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';
import { getPool } from '../lib/mysql';

const ROOT = process.cwd();

function loadLocalEnv() {
  const envPath = resolve(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();
  const mysqlConn = await getPool().getConnection();

  console.log('\nEcoTrace verification');
  console.log('═══════════════════════════════════════════════════');

  const [tables] = await mysqlConn.query(
    `SELECT TABLE_NAME AS table_name FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
  );
  console.log('\nTables');
  (tables as { table_name: string }[]).forEach((row) =>
    console.log(`  • ${row.table_name}`),
  );

  const [views] = await mysqlConn.query(
    `SELECT TABLE_NAME AS table_name FROM information_schema.views
      WHERE table_schema = DATABASE() ORDER BY TABLE_NAME`,
  );
  console.log('\nViews');
  (views as { table_name: string }[]).forEach((row) =>
    console.log(`  • ${row.table_name}`),
  );

  const [triggers] = await mysqlConn.query(
    `SELECT TRIGGER_NAME AS trigger_name FROM information_schema.triggers
      WHERE TRIGGER_SCHEMA = DATABASE()`,
  );
  console.log('\nTriggers');
  (triggers as { trigger_name: string }[]).forEach((row) =>
    console.log(`  • ${row.trigger_name}`),
  );

  const [routines] = await mysqlConn.query(
    `SELECT ROUTINE_NAME AS routine_name, ROUTINE_TYPE AS routine_type FROM information_schema.routines
      WHERE ROUTINE_SCHEMA = DATABASE()
      ORDER BY ROUTINE_NAME`,
  );
  console.log('\nRoutines');
  (routines as { routine_name: string; routine_type: string }[]).forEach(
    (row) => console.log(`  • ${row.routine_name} (${row.routine_type})`),
  );

  // Compliance summary (inlined — advanced.sql views are PostgreSQL-only)
  const [compliance] = await mysqlConn.query(
    `SELECT
            d.name AS department,
            CAST(d.emission_cap AS DECIMAL(12,2)) AS emission_cap,
            CAST(COALESCE(SUM(e.value_kgco2), 0) AS DECIMAL(12,2)) AS ytd_emissions,
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
      GROUP BY d.dept_id, d.name, d.emission_cap
      ORDER BY utilisation_pct DESC`,
  );
  console.log('\nCompliance summary');
  (compliance as {
    department: string;
    emission_cap: number;
    ytd_emissions: number;
    utilisation_pct: number;
    status: string;
  }[]).forEach((row) =>
    console.log(
      `  • ${row.department.padEnd(12)} ${String(row.ytd_emissions).padStart(9)} / ${String(row.emission_cap).padEnd(9)} kg  ${row.utilisation_pct}%  ${row.status}`,
    ),
  );

  // Check for app-side embeddings stored as JSON
  const [vectorCheck] = await mysqlConn.query(
    `SELECT
        EXISTS (
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = 'vendor_reports'
               AND column_name = 'embedding'
        ) AS installed,
        COALESCE((SELECT COUNT(*) FROM vendor_reports WHERE embedding IS NOT NULL AND embedding != ''), 0) AS embedded`,
  );
  console.log('\nApp-side vectors');
  const vc = vectorCheck as { installed: number; embedded: number }[];
  console.log(
    `  • embedding column present: ${Boolean(vc[0].installed)}; embedded vendor rows: ${vc[0].embedded}`,
  );

  const mongo = new MongoClient(process.env.MONGODB_URI ?? '', {
    serverSelectionTimeoutMS: 5_000,
  });
  await mongo.connect();
  const mongoCount = await mongo
    .db()
    .collection('vendor_reports')
    .countDocuments();
  console.log('\nMongoDB');
  console.log(`  • vendor_reports documents: ${mongoCount}`);

  await mongo.close();
  await mysqlConn.release();

  console.log('\nAll checks completed.');
  console.log('════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('\nVerification failed:', error);
  process.exitCode = 1;
});

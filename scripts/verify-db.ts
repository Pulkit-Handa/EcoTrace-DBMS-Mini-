/**
 * EcoTrace — quick database verification.
 * Prints the relational objects, compliance view, row counts, pgvector state
 * and MongoDB document count.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { MongoClient } from 'mongodb';

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
  const pg = new Client({ connectionString: process.env.POSTGRES_URL });
  await pg.connect();

  console.log('\nEcoTrace verification');
  console.log('══════════════════════════════════════════════');

  const tables = await pg.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name`,
  );
  console.log('\nTables');
  tables.rows.forEach((row) => console.log(`  • ${row.table_name}`));

  const views = await pg.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.views
      WHERE table_schema='public' ORDER BY table_name`,
  );
  console.log('\nViews');
  views.rows.forEach((row) => console.log(`  • ${row.table_name}`));

  const trigger = await pg.query<{ trigger_name: string }>(
    `SELECT trigger_name FROM information_schema.triggers
      WHERE trigger_schema='public'`,
  );
  console.log('\nTrigger');
  trigger.rows.forEach((row) => console.log(`  • ${row.trigger_name}`));

  const procedure = await pg.query<{ routine_name: string; routine_type: string }>(
    `SELECT routine_name, routine_type FROM information_schema.routines
      WHERE routine_schema='public' AND routine_name IN ('buy_credits','flag_breach')
      ORDER BY routine_name`,
  );
  console.log('\nRoutines');
  procedure.rows.forEach((row) =>
    console.log(`  • ${row.routine_name} (${row.routine_type})`),
  );

  const compliance = await pg.query<{
    department: string;
    emission_cap: number;
    ytd_emissions: number;
    utilisation_pct: number;
    status: string;
  }>(
    `SELECT department, emission_cap, ytd_emissions, utilisation_pct, status
       FROM compliance_summary ORDER BY utilisation_pct DESC`,
  );
  console.log('\nCompliance summary');
  compliance.rows.forEach((row) =>
    console.log(
      `  • ${row.department.padEnd(12)} ${String(row.ytd_emissions).padStart(9)} / ${String(row.emission_cap).padEnd(9)} kg  ${row.utilisation_pct}%  ${row.status}`,
    ),
  );

  const vector = await pg.query<{ installed: boolean; embedded: number }>(
    `SELECT
       EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') AS installed,
       COALESCE((SELECT COUNT(*)::int FROM vendor_reports WHERE embedding IS NOT NULL), 0) AS embedded`,
  );
  console.log('\npgvector');
  console.log(
    `  • extension installed: ${vector.rows[0].installed}; embedded vendor rows: ${vector.rows[0].embedded}`,
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
  await pg.end();

  console.log('\nAll checks completed.');
  console.log('══════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('\nVerification failed:', error);
  process.exitCode = 1;
});

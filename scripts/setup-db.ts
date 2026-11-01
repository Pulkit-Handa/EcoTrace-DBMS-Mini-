/**
 * EcoTrace — one-command database setup (MySQL + MongoDB + app-side vectors).
 *
 *   1. Applies db/schema.sql, db/seed.sql and db/advanced.sql to MySQL
 *   2. Replaces the MongoDB vendor_reports collection with sample documents
 *   3. Inserts the SQL bridge rows and stores app-computed embeddings as JSON
 *
 * Run with: npm run db:setup
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';
import { buildDocumentEmbedding } from '../lib/embeddings';
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

function sqlFile(name: string): string {
  return readFileSync(resolve(ROOT, 'db', name), 'utf8');
}

interface SeedDocument {
  vendor_name: string;
  dept_id: number;
  raw_text: string;
  compliance_tags: string[];
  reporting_year: number;
  metadata: {
    pages: number;
    uploader_id: number;
    uploaded_by: string;
    source: string;
  };
  createdAt: Date;
}

const seedDocuments: SeedDocument[] = [
  {
    vendor_name: 'GreenLogix Pvt Ltd',
    dept_id: 1,
    raw_text:
      'GreenLogix follows the GHG Protocol Corporate Standard for all Scope 3 category 11 reporting. Supplier logistics activity is collected monthly, verified against ISO 14064 guidelines and reviewed by an independent third-party assurance team. Emissions factors are updated annually from DEFRA and the GHG Protocol dataset.',
    compliance_tags: ['GHG Protocol', 'ISO 14064', 'Scope 3 Cat 11'],
    reporting_year: 2026,
    metadata: {
      pages: 12,
      uploader_id: 1,
      uploaded_by: 'Alice Chen',
      source: 'seed',
    },
    createdAt: new Date('2026-09-18T10:30:00.000Z'),
  },
  {
    vendor_name: 'NordWind Energy Solutions',
    dept_id: 2,
    raw_text:
      'NordWind supplies renewable wind and solar electricity under a verified power purchase agreement. The 2026 disclosure includes Scope 2 market-based emissions, renewable energy certificates and an independent assurance statement confirming a 38 percent reduction in purchased energy emissions.',
    compliance_tags: ['Renewable Energy', 'Scope 2', 'ISO 14064'],
    reporting_year: 2026,
    metadata: {
      pages: 8,
      uploader_id: 3,
      uploaded_by: 'Bob Patel',
      source: 'seed',
    },
    createdAt: new Date('2026-08-02T14:05:00.000Z'),
  },
  {
    vendor_name: 'TransRoute Logistics',
    dept_id: 3,
    raw_text:
      'TransRoute reports upstream and downstream freight emissions using the GLEC Framework and Scope 3 category 11 guidance. The analysis covers road, rail and sea transport, supplier fuel consumption and warehouse transfers across the value chain. Data quality is rated at level 3 pending customer meter integration.',
    compliance_tags: ['Scope 3 Cat 11', 'GLEC Framework', 'Supply Chain'],
    reporting_year: 2025,
    metadata: {
      pages: 19,
      uploader_id: 4,
      uploaded_by: 'Carol Nair',
      source: 'seed',
    },
    createdAt: new Date('2026-07-11T08:45:00.000Z'),
  },
  {
    vendor_name: 'TerraCarbon Assurance',
    dept_id: 1,
    raw_text:
      'TerraCarbon provides independent verification of the company net zero transition plan and science-based targets. The audit covers emissions inventory boundaries, carbon offset retirement, governance controls and alignment with the Corporate Sustainability Reporting Directive. No material misstatements were identified.',
    compliance_tags: ['Audit', 'SBTi', 'Net Zero', 'CSRD'],
    reporting_year: 2026,
    metadata: {
      pages: 24,
      uploader_id: 1,
      uploaded_by: 'Alice Chen',
      source: 'seed',
    },
    createdAt: new Date('2026-06-27T16:20:00.000Z'),
  },
  {
    vendor_name: 'Harvest & Co Foods',
    dept_id: 2,
    raw_text:
      'Harvest & Co discloses agricultural supply chain emissions under CSRD and the GHG Protocol. Scope 3 category 1 purchased goods are estimated with regional emission factors, while food waste and cold storage energy are monitored through supplier ESG questionnaires. External assurance is planned for the next reporting cycle.',
    compliance_tags: ['CSRD', 'ESG Disclosure', 'Scope 3 Cat 1'],
    reporting_year: 2025,
    metadata: {
      pages: 15,
      uploader_id: 3,
      uploaded_by: 'Bob Patel',
      source: 'seed',
    },
    createdAt: new Date('2026-05-14T11:10:00.000Z'),
  },
];

async function main() {
  loadLocalEnv();

  const mysqlUrl = process.env.MYSQL_URL;
  const mongoUrl = process.env.MONGODB_URI;

  if (!mysqlUrl) throw new Error('MYSQL_URL is missing in .env.local');
  if (!mongoUrl) throw new Error('MONGODB_URI is missing in .env.local');

  console.log('\nEcoTrace database setup');
  console.log('──────────────────────────────────────────────');

  const mysqlConn = await getPool().getConnection();

  try {
    console.log('→ Applying relational schema...');
    await mysqlConn.query(sqlFile('schema.sql'));

    console.log('→ Seeding departments, users, emissions and credits...');
    await mysqlConn.query(sqlFile('seed.sql'));

    // Note: db/advanced.sql is PostgreSQL-only (views, triggers, procedures)
    // and is intentionally skipped for MySQL. View logic is inlined in
    // lib/queries.ts so the app works without it.

    const mongo = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: 8_000,
    });
    await mongo.connect();

    try {
      const database = mongo.db();
      const collection = database.collection<SeedDocument>('vendor_reports');

      console.log('→ Resetting MongoDB vendor_reports collection...');
      await collection.drop().catch(() => undefined);

      const result = await collection.insertMany(seedDocuments);
      const ids = Object.values(result.insertedIds).map((id) => String(id));

      console.log('→ Linking MongoDB documents from MySQL...');
      const reportIds: number[] = [];

      for (let index = 0; index < seedDocuments.length; index += 1) {
        const document = seedDocuments[index];
        const [insertResult] = await mysqlConn.query(
          `INSERT INTO vendor_reports
               (vendor_name, dept_id, mongo_doc_id, uploaded_at)
           VALUES (?, ?, ?, ?)`,
          [
            document.vendor_name,
            document.dept_id,
            ids[index],
            document.createdAt,
          ],
        );
        const insertId = Number((insertResult as { insertId: number }).insertId);
        reportIds.push(insertId);

        console.log(
          `→ Generating embedding for ${document.vendor_name}...`,
        );
        const embedding = buildDocumentEmbedding({
          vendor_name: document.vendor_name,
          raw_text: document.raw_text,
          compliance_tags: document.compliance_tags,
          reporting_year: document.reporting_year,
        });
        await mysqlConn.query(
          `UPDATE vendor_reports SET embedding = ? WHERE report_id = ?`,
          [JSON.stringify(embedding), insertId],
        );
      }

      const [countRows] = await mysqlConn.query(
        `SELECT
            (SELECT COUNT(*) FROM departments) AS departments,
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM emission_records) AS emissions,
            (SELECT COUNT(*) FROM carbon_credits) AS credits,
            (SELECT COUNT(*) FROM vendor_reports) AS vendors`,
      );

      const summary = (countRows as { departments: number; users: number; emissions: number; credits: number; vendors: number }[])[0];
      console.log('\nSetup complete');
      console.log('──────────────────────────────────────────────');
      console.log(`  MySQL    : ${summary.departments} departments, ${summary.users} users,`);
      console.log(`               ${summary.emissions} emission records, ${summary.credits} credit transactions`);
      console.log(`  MongoDB  : ${ids.length} vendor reports`);
      console.log(`  Vectors  : app-side cosine similarity (384 dimensions, stored as JSON)`);
      console.log('\nDemo accounts (password: password123)');
      console.log('  auditor   → alice@eco.com');
      console.log('  dept lead → bob@eco.com   (Operations)');
      console.log('  dept lead → carol@eco.com (Logistics)');
      console.log('\nStart the app: npm run dev\n');
    } finally {
      await mongo.close();
    }
  } finally {
    mysqlConn.release();
  }
}

main().catch((error) => {
  console.error('\nSetup failed:', error);
  process.exitCode = 1;
});

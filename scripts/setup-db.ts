/**
 * EcoTrace — one-command database setup.
 *
 *   1. Applies db/schema.sql, db/seed.sql and db/advanced.sql
 *   2. Attempts the optional pgvector migration
 *   3. Replaces the MongoDB vendor_reports collection with sample documents
 *   4. Inserts the SQL bridge rows and generates pgvector embeddings
 *
 * Run with: npm run db:setup
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { MongoClient } from 'mongodb';
import {
  buildDocumentEmbedding,
  toVectorLiteral,
} from '../lib/embeddings';

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

  const postgresUrl = process.env.POSTGRES_URL;
  const mongoUrl = process.env.MONGODB_URI;

  if (!postgresUrl) throw new Error('POSTGRES_URL is missing in .env.local');
  if (!mongoUrl) throw new Error('MONGODB_URI is missing in .env.local');

  console.log('\nEcoTrace database setup');
  console.log('──────────────────────────────────────────────');

  const pg = new Client({ connectionString: postgresUrl });
  await pg.connect();

  try {
    console.log('→ Applying relational schema...');
    await pg.query(sqlFile('schema.sql'));

    console.log('→ Seeding departments, users, emissions and credits...');
    await pg.query(sqlFile('seed.sql'));

    console.log('→ Creating views, trigger and stored procedure...');
    await pg.query(sqlFile('advanced.sql'));

    let vectorReady = false;
    try {
      console.log('→ Enabling pgvector...');
      await pg.query(sqlFile('pgvector.sql'));
      vectorReady = true;
    } catch (error) {
      console.warn(
        '  ! pgvector unavailable — continuing with MongoDB text search only.',
      );
      console.warn(
        `    ${error instanceof Error ? error.message.split('\n')[0] : error}`,
      );
    }

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

      await collection.createIndex(
        {
          vendor_name: 'text',
          raw_text: 'text',
          compliance_tags: 'text',
        },
        {
          name: 'vendor_reports_text_idx',
          weights: { vendor_name: 5, compliance_tags: 3, raw_text: 1 },
        },
      );
      await collection.createIndex({ dept_id: 1, reporting_year: -1 });

      console.log('→ Linking MongoDB documents from PostgreSQL...');
      const reportIds: number[] = [];

      for (let index = 0; index < seedDocuments.length; index += 1) {
        const document = seedDocuments[index];
        const inserted = await pg.query<{ report_id: number }>(
          `INSERT INTO vendor_reports
               (vendor_name, dept_id, mongo_doc_id, uploaded_at)
           VALUES ($1, $2, $3, $4)
           RETURNING report_id`,
          [
            document.vendor_name,
            document.dept_id,
            ids[index],
            document.createdAt,
          ],
        );
        reportIds.push(inserted.rows[0].report_id);
      }

      if (vectorReady) {
        console.log('→ Generating 384-dimension pgvector embeddings...');
        for (let index = 0; index < seedDocuments.length; index += 1) {
          const document = seedDocuments[index];
          const embedding = buildDocumentEmbedding({
            vendor_name: document.vendor_name,
            raw_text: document.raw_text,
            compliance_tags: document.compliance_tags,
            reporting_year: document.reporting_year,
          });
          await pg.query(
            `UPDATE vendor_reports SET embedding = $1::vector WHERE report_id = $2`,
            [toVectorLiteral(embedding), reportIds[index]],
          );
        }
      }

      const counts = await pg.query<{
        departments: number;
        users: number;
        emissions: number;
        credits: number;
        vendors: number;
      }>(
        `SELECT
            (SELECT COUNT(*)::int FROM departments) AS departments,
            (SELECT COUNT(*)::int FROM users) AS users,
            (SELECT COUNT(*)::int FROM emission_records) AS emissions,
            (SELECT COUNT(*)::int FROM carbon_credits) AS credits,
            (SELECT COUNT(*)::int FROM vendor_reports) AS vendors`,
      );

      const summary = counts.rows[0];
      console.log('\nSetup complete');
      console.log('──────────────────────────────────────────────');
      console.log(`  PostgreSQL : ${summary.departments} departments, ${summary.users} users,`);
      console.log(`               ${summary.emissions} emission records, ${summary.credits} credit transactions`);
      console.log(`  MongoDB    : ${ids.length} vendor reports`);
      console.log(`  pgvector   : ${vectorReady ? 'enabled (384 dimensions)' : 'disabled'}`);
      console.log('\nDemo accounts (password: password123)');
      console.log('  auditor   → alice@eco.com');
      console.log('  dept lead → bob@eco.com   (Operations)');
      console.log('  dept lead → carol@eco.com (Logistics)');
      console.log('\nStart the app: npm run dev\n');
    } finally {
      await mongo.close();
    }
  } finally {
    await pg.end();
  }
}

main().catch((error) => {
  console.error('\nSetup failed:', error);
  process.exitCode = 1;
});

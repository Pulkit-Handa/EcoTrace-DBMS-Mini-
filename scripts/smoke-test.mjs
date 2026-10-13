/**
 * EcoTrace end-to-end smoke test.
 *
 * Requires the app to be running (npm run dev or npm run start) and the
 * database to be seeded (npm run db:setup).
 *
 * Usage: npm run smoke
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { MongoClient, ObjectId } from 'mongodb';

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

loadLocalEnv();

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SMOKE_DESCRIPTION = 'Automated smoke test — safe to delete';
const SMOKE_BOB_DESCRIPTION = 'Automated dept-lead smoke test — safe to delete';

let passed = 0;
let failed = 0;
const createdEmissionIds = [];
let uploadedReportId = null;
let uploadedMongoId = null;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    redirect: options.redirect ?? 'follow',
  });

  let json = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    json = await response.json().catch(() => null);
  }

  return { response, json };
}

async function login(email, password) {
  const { response, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${json?.error ?? response.status}`);
  }

  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);

  const session = setCookies.find((cookie) =>
    cookie.startsWith('ecotrace_session='),
  );

  if (!session) throw new Error('Login response did not set a session cookie');
  return session.split(';')[0];
}

async function cleanup() {
  const pg = new Client({ connectionString: process.env.POSTGRES_URL });
  await pg.connect();
  try {
    await pg.query(`DELETE FROM emission_records WHERE description = ANY($1)`, [
      [SMOKE_DESCRIPTION, SMOKE_BOB_DESCRIPTION],
    ]);
    if (uploadedReportId) {
      await pg.query(`DELETE FROM vendor_reports WHERE report_id = $1`, [
        uploadedReportId,
      ]);
    }
  } finally {
    await pg.end();
  }

  if (uploadedMongoId) {
    const mongo = new MongoClient(process.env.MONGODB_URI);
    await mongo.connect();
    try {
      await mongo
        .db()
        .collection('vendor_reports')
        .deleteOne({ _id: new ObjectId(uploadedMongoId) });
    } finally {
      await mongo.close();
    }
  }
}

async function main() {
  console.log(`\nEcoTrace smoke test · ${BASE}`);
  console.log('══════════════════════════════════════════════');

  console.log('\nHealth & public protection');
  const health = await request('/api/health');
  check('health endpoint returns 200', health.response.status === 200);
  check('PostgreSQL connected', health.json?.postgres?.connected === true);
  check('MongoDB connected', health.json?.mongodb?.connected === true);
  check('pgvector ready', health.json?.postgres?.vectorReady === true);
  check('exactly five core tables', health.json?.postgres?.tables === 5);

  const unauth = await request('/api/reports');
  check('reports API rejects anonymous access', unauth.response.status === 401);

  const dashboardRedirect = await fetch(`${BASE}/dashboard`, {
    redirect: 'manual',
  });
  check(
    'dashboard redirects anonymous users to login',
    [302, 307].includes(dashboardRedirect.status) &&
      (dashboardRedirect.headers.get('location') ?? '').includes('/login'),
  );

  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'alice@eco.com', password: 'wrong-password' },
  });
  check('bad password is rejected', badLogin.response.status === 401);

  console.log('\nAuditor access');
  const auditorCookie = await login('alice@eco.com', 'password123');
  const me = await request('/api/auth/me', { cookie: auditorCookie });
  check('auditor session is valid', me.response.status === 200);
  check('auditor role claim', me.json?.user?.role === 'auditor');

  const dashboard = await request('/dashboard', { cookie: auditorCookie });
  check('auditor can open dashboard', dashboard.response.status === 200);

  const reports = await request('/api/reports?type=all', {
    cookie: auditorCookie,
  });
  check('reports API returns 200', reports.response.status === 200);
  check(
    'compliance report has all three departments',
    reports.json?.compliance?.length === 3,
  );
  check(
    'cap breach report finds two departments',
    reports.json?.cap_breaches?.length === 2,
  );
  check(
    'scope report is populated',
    Array.isArray(reports.json?.scope_breakdown) &&
      reports.json.scope_breakdown.length >= 3,
  );
  check(
    'top emitter report respects HAVING threshold',
    reports.json?.top_emitters?.length >= 1,
  );

  const singleReport = await request('/api/reports?type=compliance', {
    cookie: auditorCookie,
  });
  check(
    'type filter returns only requested report',
    singleReport.json?.compliance?.length === 3 &&
      singleReport.json?.scope_breakdown === undefined,
  );

  const insert = await request('/api/emissions', {
    method: 'POST',
    cookie: auditorCookie,
    body: {
      dept_id: 1,
      scope: 2,
      value_kgco2: 25.5,
      description: SMOKE_DESCRIPTION,
    },
  });
  check('auditor can insert an emission', insert.response.status === 201);
  if (insert.json?.record?.record_id) {
    createdEmissionIds.push(insert.json.record.record_id);
  }
  check(
    'insert returns a compliance snapshot',
    typeof insert.json?.compliance?.status === 'string',
  );

  console.log('\nDepartment-lead scoping');
  const leadCookie = await login('bob@eco.com', 'password123');
  const leadReports = await request('/api/reports?type=all', {
    cookie: leadCookie,
  });
  check(
    'department lead sees one department',
    leadReports.json?.compliance?.length === 1,
  );
  check(
    'department lead sees only Operations',
    leadReports.json?.compliance?.[0]?.department === 'Operations',
  );

  const crossDeptRead = await request('/api/emissions?dept_id=1', {
    cookie: leadCookie,
  });
  check(
    'department lead cannot read another department',
    crossDeptRead.response.status === 403,
  );

  const crossDeptWrite = await request('/api/emissions', {
    method: 'POST',
    cookie: leadCookie,
    body: { dept_id: 1, scope: 1, value_kgco2: 10 },
  });
  check(
    'department lead cannot write to another department',
    crossDeptWrite.response.status === 403,
  );

  const leadInsert = await request('/api/emissions', {
    method: 'POST',
    cookie: leadCookie,
    body: {
      dept_id: 2,
      scope: 3,
      value_kgco2: 12.25,
      description: SMOKE_BOB_DESCRIPTION,
    },
  });
  check('department lead can insert own-department emission', leadInsert.response.status === 201);
  if (leadInsert.json?.record?.record_id) {
    createdEmissionIds.push(leadInsert.json.record.record_id);
  }

  console.log('\nMongoDB & pgvector search');
  const textSearch = await request('/api/search', {
    method: 'POST',
    cookie: auditorCookie,
    body: { query: 'GHG Protocol', mode: 'text' },
  });
  check('text search returns 200', textSearch.response.status === 200);
  check('text search finds a vendor document', textSearch.json?.results?.length > 0);
  check('text search mode reported', textSearch.json?.mode_used === 'text');

  const vectorSearch = await request('/api/search', {
    method: 'POST',
    cookie: auditorCookie,
    body: { query: 'carbon accounting standard', mode: 'vector' },
  });
  check('vector search returns 200', vectorSearch.response.status === 200);
  check('vector search finds a document', vectorSearch.json?.results?.length > 0);
  check('vector mode reported', vectorSearch.json?.mode_used === 'vector');
  check(
    'vector search returns similarity scores',
    typeof vectorSearch.json?.results?.[0]?.similarity === 'number',
  );

  const leadSearch = await request('/api/search', {
    method: 'POST',
    cookie: leadCookie,
    body: { query: 'energy', mode: 'text', dept_id: 1 },
  });
  check(
    'department lead cannot search another department',
    leadSearch.response.status === 403,
  );

  console.log('\nDual-database upload');
  const upload = await request('/api/upload', {
    method: 'POST',
    cookie: auditorCookie,
    body: {
      vendor_name: 'Smoke Test Vendor',
      dept_id: 1,
      reporting_year: 2026,
      pages: 3,
      compliance_tags: 'GHG Protocol, ISO 14064',
      raw_text:
        'This is an automated smoke-test vendor disclosure covering GHG Protocol Scope 2 electricity reporting, independent verification and renewable energy certificates.',
    },
  });
  check('upload returns 201', upload.response.status === 201);
  check('upload stored a MongoDB id', typeof upload.json?.mongo_doc_id === 'string');
  check('upload created a SQL bridge row', typeof upload.json?.report_id === 'number');
  check('upload stored a pgvector embedding', upload.json?.vector_stored === true);
  uploadedReportId = upload.json?.report_id ?? null;
  uploadedMongoId = upload.json?.mongo_doc_id ?? null;

  if (uploadedReportId && uploadedMongoId) {
    const pg = new Client({ connectionString: process.env.POSTGRES_URL });
    await pg.connect();
    const bridge = await pg.query(
      `SELECT report_id, mongo_doc_id FROM vendor_reports WHERE report_id = $1`,
      [uploadedReportId],
    );
    await pg.end();
    check(
      'SQL bridge row points to the MongoDB document',
      bridge.rows[0]?.mongo_doc_id === uploadedMongoId,
    );
  }

  const uploadSearch = await request('/api/search', {
    method: 'POST',
    cookie: auditorCookie,
    body: { query: 'Smoke Test Vendor', mode: 'text' },
  });
  check(
    'uploaded document is searchable',
    uploadSearch.json?.results?.some((hit) => hit.vendor_name === 'Smoke Test Vendor'),
  );

  console.log('\nLogout');
  const logout = await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie: auditorCookie },
  });
  check('logout returns 200', logout.status === 200);
  const logoutCookies =
    typeof logout.headers.getSetCookie === 'function'
      ? logout.headers.getSetCookie()
      : [logout.headers.get('set-cookie')].filter(Boolean);
  check(
    'logout expires the session cookie',
    logoutCookies.some(
      (cookie) =>
        cookie.includes('ecotrace_session=') &&
        /max-age=0/i.test(cookie),
    ),
  );

  console.log('\nCleanup');
  await cleanup();
  console.log('  ✓ smoke-test rows removed');

  console.log('\n══════════════════════════════════════════════');
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error('\nSmoke test failed:', error);
  try {
    await cleanup();
  } catch (cleanupError) {
    console.error('Cleanup failed:', cleanupError);
  }
  process.exitCode = 1;
});

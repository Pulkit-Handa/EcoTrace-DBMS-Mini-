# EcoTrace — Database Documentation

## 1. Problem statement

EcoTrace is a semester-5 DBMS mini project that tracks organisational carbon
emissions against departmental caps. The platform must:

- Store **structured** Scope 1–3 emission records, users, departments and carbon
  credit transactions relationally with ACID guarantees (PostgreSQL).
- Store **unstructured** vendor ESG disclosure documents flexibly (MongoDB).
- Bridge both stores so every MongoDB vendor report links back to PostgreSQL
  via `vendor_reports.mongo_doc_id`.
- Support role-based access: auditors see every department; department leads see
  only their own department.
- Demonstrate advanced SQL (views, trigger, stored procedure, transaction,
  subquery, JOIN + GROUP BY + HAVING) and one NoSQL advanced feature
  (MongoDB aggregation / text index / pgvector semantic search).
- Provide three pages: `/dashboard`, `/reports`, `/search`.

## 2. Entity–relationship diagram

Five tables (`departments`, `users`, `emission_records`, `carbon_credits`,
`vendor_reports`) plus the bridge to MongoDB. The ER diagram was drawn on
[dbdiagram.io](https://dbdiagram.io) and exported as `docs/er-diagram.png`.

The dbdiagram.io DBML source:

```dbml
Table departments {
  dept_id serial [pk]
  name varchar(100) [not null, unique]
  emission_cap decimal(12,2) [not null, "> 0"]
}

Table users {
  user_id serial [pk]
  name varchar(100) [not null]
  email varchar(150) [not null, unique]
  password_hash text [not null]
  role varchar(20) [check: role in ('auditor','dept_lead')]
  dept_id int [null, ref: > departments.dept_id, on delete: set null]
}

Table emission_records {
  record_id serial [pk]
  dept_id int [not null, ref: > departments.dept_id]
  user_id int [not null, ref: > users.user_id]
  scope smallint [not null, check: scope in (1,2,3)]
  value_kgco2 decimal(12,2) [not null, "> 0"]
  recorded_at timestamp [default: now()]
  description text
}

Table carbon_credits {
  credit_id serial [pk]
  dept_id int [not null, ref: > departments.dept_id]
  quantity decimal(10,2) [not null, "> 0"]
  price_per_unit decimal(8,2) [not null, ">= 0"]
  txn_type varchar(10) [not null, check: txn_type in ('buy','sell','offset')]
}

Table vendor_reports {
  report_id serial [pk]
  vendor_name varchar(150) [not null]
  dept_id int [not null, ref: > departments.dept_id]
  mongo_doc_id varchar(100) [not null, unique]
  uploaded_at timestamp [default: now()]
  embedding vector(384) [null] -- optional pgvector extension
}

Table "vendor_reports.mongo" [note: 'MongoDB Atlas collection: vendor_reports'] {
  _id string [pk]
  vendor_name string
  dept_id number
  raw_text string
  compliance_tags array[string]
  reporting_year number
  metadata object
}

Ref: departments.dept_id > users.dept_id
Ref: departments.dept_id > emission_records.dept_id
Ref: users.user_id > emission_records.user_id
Ref: departments.dept_id > carbon_credits.dept_id
Ref: departments.dept_id > vendor_reports.dept_id
Ref: vendor_reports.mongo_doc_id > "vendor_reports.mongo"._id
```

Copy the block above into dbdiagram.io and save as an image for the project
report. The relationship `vendor_reports.mongo_doc_id` → `_id` is a logical
bridge across SQL ↔ MongoDB, not a database-level FK.

## 3. Physical schema (DDL)

See `db/schema.sql`. It contains:

- Five `CREATE TABLE` statements with PKs, FKs, `UNIQUE`, `CHECK`,
  `NOT NULL` constraints.
- One required `ALTER TABLE emission_records ADD COLUMN description TEXT`.
- Indexes: `idx_emission_dept`, `idx_emission_date`,
  `idx_vendor_reports_dept`, `idx_vendor_reports_uploaded`.
- Optional `db/pgvector.sql`: `CREATE EXTENSION vector`, adds
  `vendor_reports.embedding vector(384)` and an HNSW `vector_cosine_ops`
  index for semantic search.

Apply once:

```bash
psql "$POSTGRES_URL" -f db/schema.sql
psql "$POSTGRES_URL" -f db/pgvector.sql   # optional novelty feature
```

## 4. Advanced SQL objects (4 required)

`db/advanced.sql` creates, in order:

1. **View — `compliance_summary`**  
   `LEFT JOIN` + `GROUP BY` + `COALESCE` + `CASE`, producing YTD emissions,
   remaining kg, utilisation % and `Compliant` / `Non-Compliant` status per
   department.
2. **View — `dept_scope_summary`**  
   `JOIN` + `GROUP BY` + `HAVING` + `AVG`/`SUM`, giving emissions per
   department per GHG scope.
3. **View — `non_compliant_departments`**  
   Filter over `compliance_summary` where `status = 'Non-Compliant'`.
4. **Trigger — `check_cap`** + function `flag_breach()`  
   `AFTER INSERT` on `emission_records`; raises a PostgreSQL `NOTICE` when a
   department's YTD total exceeds its cap.
5. **Stored procedure — `buy_credits(...)`**  
   Validates quantity/price, locks the department row, inserts a `buy`
   transaction into `carbon_credits`.
6. **Transaction wrapper**  
   `BEGIN; CALL buy_credits(...); COMMIT;` — the atomic credit purchase.

Also: `db/verify.sql` lists all tables, views, constraints, indexes, triggers
and routines and prints the compliance report.

## 5. DML demonstration

`db/dml-demo.sql` runs inside a `BEGIN ... ROLLBACK` block so it is fully
repeatable and leaves seeded data untouched:

- `INSERT` into `emission_records` (triggers `check_cap`).
- `UPDATE departments SET emission_cap = 5500 ...`
- `DELETE FROM vendor_reports WHERE report_id = 3;`
- `SELECT ... JOIN ... GROUP BY ... HAVING SUM(...) > 100 ORDER BY ...`
- Subquery with `IN` to find departments whose YTD emissions exceed 3000 kg.

## 6. MongoDB (NoSQL)

Collection `vendor_reports` on MongoDB Atlas (or local `mongo:7` via Docker).

Sample document:

```json
{
  "_id": "ObjectId(...)",
  "vendor_name": "GreenLogix Pvt Ltd",
  "dept_id": 1,
  "raw_text": "GreenLogix follows GHG Protocol for all Scope 3 reporting...",
  "compliance_tags": ["GHG Protocol", "ISO 14064", "Scope 3 Cat 11"],
  "reporting_year": 2025,
  "metadata": { "pages": 12, "uploader_id": 2 },
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

Schema definition: `lib/mongo.ts` (mongoose model `VendorReport`).

NoSQL advanced feature — aggregation pipeline (average compliance tags per
year), runnable in Atlas or via mongoose:

```javascript
db.vendor_reports.aggregate([
  { $group: {
      _id: "$reporting_year",
      vendors: { $sum: 1 },
      avg_tags: { $avg: { $size: "$compliance_tags" } }
  }},
  { $sort: { _id: -1 } }
])
```

A text index on `vendor_name`, `raw_text` and `compliance_tags` powers the
full-text search used by `/api/search`.

## 7. pgvector novelty feature

`vendor_reports.embedding vector(384)` plus an HNSW index (`vector_cosine_ops`)
lets the search page rank vendor documents by cosine similarity against a
query embedding. Embeddings are generated offline with a deterministic 384-dim
feature hash (`lib/embeddings.ts`), so no external embedding API is required.
If pgvector is unavailable, search gracefully falls back to MongoDB `$text`.

## 8. Roles & auth

Two roles from the brief: `auditor` and `dept_lead`.

- Signed HttpOnly JWT cookie (`ecotrace_session`, HS256 via `jose`).
- `lib/auth.ts`: `getSession`, `requireSession`, `authenticateUser`,
  `assertDepartmentAccess`, `scopedDepartmentId`.
- `middleware.ts`: protects `/dashboard`, `/reports`, `/search`, `/admin`;
  `/admin` restricted to auditors.
- Demo accounts (password `password123`, bcrypt cost 10):
  - `alice@eco.com` — Auditor — all departments
  - `bob@eco.com` — Dept lead — Operations
  - `carol@eco.com` — Dept lead — Logistics

## 9. API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | bcrypt verify + set session cookie |
| `/api/auth/logout` | POST | Expire session cookie |
| `/api/auth/me` | GET | Return current session |
| `/api/emissions` | GET | List emissions (role-scoped) |
| `/api/emissions` | POST | Insert emission + trigger cap check |
| `/api/reports` | GET | 4 SQL reports + threshold filter |
| `/api/search` | GET | Recent MongoDB vendor documents |
| `/api/search` | POST | MongoDB `$text` or pgvector semantic search |
| `/api/upload` | POST | Dual-write: MongoDB doc + SQL bridge + vector |
| `/api/health` | GET | Postgres + MongoDB readiness |

## 10. Pages

| Page | Contents |
|---|---|
| `/dashboard` | KPI cards, department × scope stacked bar chart, cap status bars, recent activity table, scope mix, "Log emission" modal |
| `/reports` | Scope breakdown (view/join/group/having/avg), compliance (view/coalesce/case), top emitters (having/order), cap breaches (subquery/IN); per-tab SQL shown; CSV export |
| `/search` | MongoDB full-text search + pgvector semantic search; vendor document cards with similarity scores; upload modal writes to Mongo + Postgres + vector |

## 11. Build order

1. `docker compose up -d` (PostgreSQL 17 + pgvector, MongoDB 7).
2. `cp .env.example .env.local` and confirm credentials.
3. `npm run db:setup` — schema, seed, views, trigger, procedure, pgvector,
   MongoDB documents, bridge rows and embeddings.
4. `npm run db:verify` — inspect objects and compliance view.
5. `npm run dev` — open http://localhost:3000.
6. Smoke test: `npm run smoke` (40 end-to-end assertions).
7. Documentation screenshots: `npm run screenshots` → `docs/screenshots/`.

## 12. Screenshots

All captured from the running app at http://localhost:3000 (Alice Chen,
auditor, all departments):

| File | Shows |
|---|---|
| `docs/screenshots/01-login.png` | Sign-in page with demo accounts |
| `docs/screenshots/02-dashboard.png` | Dashboard: KPIs, chart, cap status, recent emissions |
| `docs/screenshots/03-reports.png` | Reports: scope breakdown, CSV export, SQL panel |
| `docs/screenshots/04-reports-cap-breaches.png` | Cap breaches tab (subquery) |
| `docs/screenshots/05-search-text.png` | MongoDB `$text` full-text search |
| `docs/screenshots/06-search-vector.png` | pgvector semantic search with similarity % |
| `docs/screenshots/07-upload-modal.png` | Dual-database vendor report upload |
| `docs/screenshots/08-dashboard-mobile.png` | Responsive mobile dashboard |

## 13. Novelty one-liner

> *"EcoTrace routes structured emissions data to PostgreSQL for ACID-safe analytics, and unstructured vendor ESG text to MongoDB for flexible document storage — with pgvector enabling semantic compliance search across both."*

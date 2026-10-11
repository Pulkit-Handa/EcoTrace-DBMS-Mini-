# EcoTrace — Carbon Compliance Platform

DBMS mini project (Semester 5). Built with **PostgreSQL 17**, **MongoDB**,
**pgvector** and **Next.js 15** (App Router, TypeScript, Tailwind).

> *"EcoTrace routes structured emissions data to PostgreSQL for ACID-safe
> analytics, and unstructured vendor ESG text to MongoDB for flexible document
> storage — with pgvector enabling semantic compliance search across both."*

## Stack

| Layer | Technology |
|---|---|
| Relational DB | PostgreSQL 17 + pgvector (Docker: `pgvector/pgvector:pg17`) |
| NoSQL | MongoDB 7 (Docker: `mongo:7` or Atlas free tier) |
| Framework | Next.js 15.5 (App Router, TypeScript) |
| Styling | Tailwind CSS 3.4 |
| Charts | Recharts |
| Auth | Signed HttpOnly JWT (`jose`), bcrypt passwords |
| DB drivers | `pg`, `mongoose`, `mongodb` |

## Checklist coverage

| Brief item | Where it lives |
|---|---|
| 5 SQL tables | `db/schema.sql` |
| Constraints (PK/FK/UNIQUE/CHECK/NOT NULL) | `db/schema.sql` |
| ALTER TABLE example | `db/schema.sql` |
| Indexes | `db/schema.sql` |
| Views | `db/advanced.sql` |
| Trigger + function | `db/advanced.sql` |
| Stored procedure | `db/advanced.sql` |
| Transaction wrapper | `db/advanced.sql` |
| DML: INSERT/UPDATE/DELETE | `db/dml-demo.sql` |
| SELECT + JOIN + GROUP BY + ORDER BY + aggregate + HAVING | `db/dml-demo.sql`, `db/advanced.sql` |
| Subquery with IN | `db/dml-demo.sql`, `db/advanced.sql` |
| MongoDB collection + document | `lib/mongo.ts`, `scripts/setup-db.ts` |
| NoSQL aggregation pipeline | `docs/database.md`, runnable in Atlas |
| pgvector semantic search | `db/pgvector.sql`, `lib/embeddings.ts`, `/api/search` |
| 3 Next.js pages | `app/(app)/{dashboard,reports,search}/page.tsx` |
| 3+ API routes | `app/api/{emissions,reports,search,upload,health,auth/*}` |
| `.env.local` | `.env.local` |
| 2 roles (auditor, dept_lead) | `lib/auth.ts`, `middleware.ts`, seed data |
| Auditor vs dept-lead scoping | `lib/auth.ts`, every API route |
| Dashboard chart + badges | `components/dashboard/*.tsx` |
| 3 SQL report tables | `components/reports/reports-client.tsx` |
| Semantic/vendor text search | `components/search/search-client.tsx` |

## Quick start (Fedora)

```bash
cp .env.example .env.local
npm install
docker compose up -d
npm run db:setup
npm run dev
# http://localhost:3000
```

Full Fedora instructions: `docs/how-to-run.md`.

## Demo accounts (password: password123)

- `alice@eco.com` — auditor — all departments
- `bob@eco.com` — dept_lead — Operations
- `carol@eco.com` — dept_lead — Logistics

## Verification

```bash
npm run build        # type-checked production build
npm run smoke        # 40 end-to-end assertions: 40 passed, 0 failed
npm run db:verify    # relational objects + MongoDB + pgvector state
```

## Documentation

- `docs/database.md` — problem statement, ER diagram source, DDL, advanced SQL,
  DML demo, MongoDB, pgvector, roles, API routes, pages, screenshots
- `docs/er-diagram.md` — DBML to paste into dbdiagram.io + mermaid data flow
- `docs/how-to-run.md` — Fedora-specific setup and runbook
- `docs/screenshots/` — 8 captured UI screenshots

## Novelty one-liner

> *"EcoTrace routes structured emissions data to PostgreSQL for ACID-safe
> analytics, and unstructured vendor ESG text to MongoDB for flexible document
> storage — with pgvector enabling semantic compliance search across both."*

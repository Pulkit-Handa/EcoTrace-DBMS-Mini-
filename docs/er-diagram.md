# ER Diagram — EcoTrace (dbdiagram.io)

## DBML source

Paste this into [dbdiagram.io](https://dbdiagram.io), then click **Render
Diagram** and export as an image:

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
  embedding vector(384) [null]
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

## Data-flow (mermaid)

```mermaid
flowchart LR
    subgraph Web ["Next.js (NextAuth-style JWT)"]
      D[/dashboard]
      R[/reports]
      S[/search]
    end

    subgraph SQL ["PostgreSQL 17 (+ pgvector)"]
      style SQL fill:#e8f5e9,stroke:#2e7d32
      departments[(departments)]
      users[(users)]
      emission_records[(emission_records)]
      carbon_credits[(carbon_credits)]
      vendor_reports[(vendor_reports + embedding vector(384))]
    end

    subgraph NoSQL ["MongoDB Atlas"]
      mongo[(vendor_reports collection<br/>raw_text, tags,<br/>compliance_tags)]
    end

    D -.-> SQL
    R -.-> SQL
    S -.-> SQL
    S -.-> mongo
    SQL -.->|bridge mongo_doc_id| mongo

    classDef pg fill:#336791,stroke:#222,color:#fff;
    class departments,users,emission_records,carbon_credits,vendor_reports pg;
```

## Relationships

| Child | Parent | FK / rule |
|---|---|---|
| users.dept_id | departments.dept_id | `ON DELETE SET NULL` |
| emission_records.dept_id | departments.dept_id | required |
| emission_records.user_id | users.user_id | required |
| carbon_credits.dept_id | departments.dept_id | required |
| vendor_reports.dept_id | departments.dept_id | required |
| vendor_reports.mongo_doc_id | mongo._id | logical bridge (unique) |

The `mongo_doc_id` → `_id` link is not enforced by the RDBMS because it spans
SQL and MongoDB; application code keeps both sides consistent in
`lib/queries.ts` and `app/api/upload/route.ts`.

## Screenshot placeholder

```
docs/screenshots/er-diagram.png   ← export from dbdiagram.io
```

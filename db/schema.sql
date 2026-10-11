-- ===========================================================================
-- EcoTrace — Relational schema (PostgreSQL 17)
-- Five core relations + constraints, ALTER, indexes, comments.
-- This file is idempotent: it drops and recreates the application objects.
-- ===========================================================================

-- Drop dependent objects first so the script can be re-run safely.
DROP VIEW IF EXISTS non_compliant_departments CASCADE;
DROP VIEW IF EXISTS compliance_summary CASCADE;
DROP VIEW IF EXISTS dept_scope_summary CASCADE;
DROP TABLE IF EXISTS vendor_reports CASCADE;
DROP TABLE IF EXISTS carbon_credits CASCADE;
DROP TABLE IF EXISTS emission_records CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP FUNCTION IF EXISTS flag_breach() CASCADE;
DROP PROCEDURE IF EXISTS buy_credits(INT, NUMERIC, NUMERIC);

-- ---------------------------------------------------------------------------
-- 1. departments
-- ---------------------------------------------------------------------------
CREATE TABLE departments (
    dept_id      SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL UNIQUE,
    emission_cap DECIMAL(12, 2) NOT NULL CHECK (emission_cap > 0)
);

COMMENT ON TABLE departments IS 'Organisational departments and their annual emission caps.';
COMMENT ON COLUMN departments.emission_cap IS 'Annual cap in kg CO2e; compliance is measured year-to-date.';

-- ---------------------------------------------------------------------------
-- 2. users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('auditor', 'dept_lead')),
    dept_id       INT REFERENCES departments(dept_id) ON DELETE SET NULL
);

COMMENT ON TABLE users IS 'Application users. Two roles: auditor (global) and dept_lead (department scoped).';

-- ---------------------------------------------------------------------------
-- 3. emission_records
-- ---------------------------------------------------------------------------
CREATE TABLE emission_records (
    record_id   SERIAL PRIMARY KEY,
    dept_id     INT NOT NULL REFERENCES departments(dept_id),
    user_id     INT NOT NULL REFERENCES users(user_id),
    scope       SMALLINT NOT NULL CHECK (scope IN (1, 2, 3)),
    value_kgco2 DECIMAL(12, 2) NOT NULL CHECK (value_kgco2 > 0),
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE emission_records IS 'Structured Scope 1/2/3 greenhouse-gas activity records in kg CO2e.';
COMMENT ON COLUMN emission_records.scope IS 'GHG Protocol scope: 1 direct, 2 purchased energy, 3 value chain.';

-- Required ALTER example: add a free-text note after the table already exists.
ALTER TABLE emission_records ADD COLUMN description TEXT;

-- Indexes for department dashboards and date-ordered activity feeds.
CREATE INDEX idx_emission_dept ON emission_records(dept_id);
CREATE INDEX idx_emission_date ON emission_records(recorded_at DESC);

-- ---------------------------------------------------------------------------
-- 4. carbon_credits
-- ---------------------------------------------------------------------------
CREATE TABLE carbon_credits (
    credit_id      SERIAL PRIMARY KEY,
    dept_id        INT NOT NULL REFERENCES departments(dept_id),
    quantity       DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    price_per_unit DECIMAL(8, 2) NOT NULL CHECK (price_per_unit >= 0),
    txn_type       VARCHAR(10) NOT NULL CHECK (txn_type IN ('buy', 'sell', 'offset'))
);

COMMENT ON TABLE carbon_credits IS 'Carbon credit purchases, sales and offsets recorded per department.';

-- ---------------------------------------------------------------------------
-- 5. vendor_reports
-- ---------------------------------------------------------------------------
CREATE TABLE vendor_reports (
    report_id    SERIAL PRIMARY KEY,
    vendor_name  VARCHAR(150) NOT NULL,
    dept_id      INT NOT NULL REFERENCES departments(dept_id),
    mongo_doc_id VARCHAR(100) NOT NULL UNIQUE,
    uploaded_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vendor_reports IS 'Relational bridge to unstructured vendor ESG documents stored in MongoDB.';

CREATE INDEX idx_vendor_reports_dept ON vendor_reports(dept_id);
CREATE INDEX idx_vendor_reports_uploaded ON vendor_reports(uploaded_at DESC);

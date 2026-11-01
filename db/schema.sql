-- ===========================================================================
-- EcoTrace — Relational schema (MySQL 8.0+)
-- Five core relations + constraints, indexes, comments.
-- ===========================================================================

-- Drop dependent objects first so the script can be re-run safely.
-- MySQL does not support CASCADE on DROP, so objects are dropped in
-- dependency order.
DROP TRIGGER IF EXISTS check_cap;
DROP PROCEDURE IF EXISTS buy_credits;
DROP FUNCTION IF EXISTS flag_breach;
DROP VIEW IF EXISTS non_compliant_departments;
DROP VIEW IF EXISTS compliance_summary;
DROP VIEW IF EXISTS dept_scope_summary;
DROP TABLE IF EXISTS vendor_reports;
DROP TABLE IF EXISTS carbon_credits;
DROP TABLE IF EXISTS emission_records;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;

-- ---------------------------------------------------------------------------
-- 1. departments
-- ---------------------------------------------------------------------------
CREATE TABLE departments (
    dept_id      INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL UNIQUE,
    emission_cap DECIMAL(12, 2) NOT NULL COMMENT 'Annual cap in kg CO2e; compliance is measured year-to-date.' CHECK (emission_cap > 0)
) COMMENT = 'Organisational departments and their annual emission caps.';

-- ---------------------------------------------------------------------------
-- 2. users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL COMMENT 'auditor (global) or dept_lead (department scoped)' CHECK (role IN ('auditor', 'dept_lead')),
    dept_id       INT COMMENT 'NULL for auditors',
    CONSTRAINT fk_users_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE SET NULL
) COMMENT = 'Application users. Two roles: auditor (global) and dept_lead (department scoped).';

-- ---------------------------------------------------------------------------
-- 3. emission_records
-- ---------------------------------------------------------------------------
CREATE TABLE emission_records (
    record_id   INT AUTO_INCREMENT PRIMARY KEY,
    dept_id     INT NOT NULL,
    user_id     INT NOT NULL,
    scope       SMALLINT NOT NULL COMMENT 'GHG Protocol scope: 1 direct, 2 purchased energy, 3 value chain.' CHECK (scope IN (1, 2, 3)),
    value_kgco2 DECIMAL(12, 2) NOT NULL CHECK (value_kgco2 > 0),
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    CONSTRAINT fk_emission_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id),
    CONSTRAINT fk_emission_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) COMMENT = 'Structured Scope 1/2/3 greenhouse-gas activity records in kg CO2e.';

CREATE INDEX idx_emission_dept ON emission_records(dept_id);
CREATE INDEX idx_emission_date ON emission_records(recorded_at DESC);

-- ---------------------------------------------------------------------------
-- 4. carbon_credits
-- ---------------------------------------------------------------------------
CREATE TABLE carbon_credits (
    credit_id      INT AUTO_INCREMENT PRIMARY KEY,
    dept_id        INT NOT NULL,
    quantity       DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    price_per_unit DECIMAL(8, 2) NOT NULL CHECK (price_per_unit >= 0),
    txn_type       VARCHAR(10) NOT NULL CHECK (txn_type IN ('buy', 'sell', 'offset')),
    CONSTRAINT fk_credits_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
) COMMENT = 'Carbon credit purchases, sales and offsets recorded per department.';

-- ---------------------------------------------------------------------------
-- 5. vendor_reports
-- ---------------------------------------------------------------------------
CREATE TABLE vendor_reports (
    report_id    INT AUTO_INCREMENT PRIMARY KEY,
    vendor_name  VARCHAR(150) NOT NULL,
    dept_id      INT NOT NULL,
    mongo_doc_id VARCHAR(100) NOT NULL UNIQUE,
    uploaded_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vendor_reports_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
) COMMENT = 'Relational bridge to unstructured vendor ESG documents stored in MongoDB.';

CREATE INDEX idx_vendor_reports_dept ON vendor_reports(dept_id);
CREATE INDEX idx_vendor_reports_uploaded ON vendor_reports(uploaded_at DESC);

-- ===========================================================================
-- EcoTrace — Advanced SQL
-- 1) Views (GROUP BY + HAVING, CASE/COALESCE)
-- 2) Trigger (cap-breach notice)
-- 3) Stored procedure (credit purchase)
-- 4) Explicit transaction wrapping the procedure
-- Run after db/schema.sql and db/seed.sql.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- View 1: department × scope report (JOIN, GROUP BY, HAVING, aggregates)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW dept_scope_summary AS
SELECT
    d.dept_id,
    d.name AS department,
    e.scope,
    COUNT(*)::int                            AS record_count,
    ROUND(AVG(e.value_kgco2), 2)::float8     AS avg_emission_kg,
    SUM(e.value_kgco2)::float8               AS total_emission_kg
FROM emission_records e
JOIN departments d ON d.dept_id = e.dept_id
WHERE e.recorded_at >= date_trunc('year', CURRENT_DATE)
GROUP BY d.dept_id, d.name, e.scope
HAVING SUM(e.value_kgco2) > 0;

COMMENT ON VIEW dept_scope_summary IS 'Year-to-date emissions grouped by department and GHG scope.';

-- ---------------------------------------------------------------------------
-- View 2: compliance summary (LEFT JOIN, COALESCE, CASE, percentage)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW compliance_summary AS
SELECT
    d.dept_id,
    d.name AS department,
    d.emission_cap::float8 AS emission_cap,
    COALESCE(SUM(e.value_kgco2), 0)::float8 AS ytd_emissions,
    GREATEST(d.emission_cap - COALESCE(SUM(e.value_kgco2), 0), 0)::float8 AS remaining_kg,
    ROUND(
        COALESCE(SUM(e.value_kgco2), 0) / NULLIF(d.emission_cap, 0) * 100,
        1
    )::float8 AS utilisation_pct,
    CASE
        WHEN COALESCE(SUM(e.value_kgco2), 0) > d.emission_cap THEN 'Non-Compliant'
        ELSE 'Compliant'
    END AS status
FROM departments d
LEFT JOIN emission_records e
    ON e.dept_id = d.dept_id
   AND e.recorded_at >= date_trunc('year', CURRENT_DATE)
GROUP BY d.dept_id, d.name, d.emission_cap;

COMMENT ON VIEW compliance_summary IS 'Year-to-date cap utilisation and compliance status per department.';

-- ---------------------------------------------------------------------------
-- View 3: convenience filter over the compliance view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW non_compliant_departments AS
SELECT *
FROM compliance_summary
WHERE status = 'Non-Compliant';

-- ---------------------------------------------------------------------------
-- Trigger: emit a server-side notice whenever a new record pushes a
-- department over its annual emission cap.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION flag_breach()
RETURNS TRIGGER AS $$
DECLARE
    v_department TEXT;
    v_cap        NUMERIC;
    v_total      NUMERIC;
BEGIN
    SELECT d.name,
           d.emission_cap,
           COALESCE(SUM(e.value_kgco2), 0)
      INTO v_department, v_cap, v_total
      FROM departments d
      LEFT JOIN emission_records e
             ON e.dept_id = d.dept_id
            AND e.recorded_at >= date_trunc('year', CURRENT_DATE)
     WHERE d.dept_id = NEW.dept_id
     GROUP BY d.name, d.emission_cap;

    IF v_total > v_cap THEN
        RAISE NOTICE
            'CAP BREACH: % is at % kg CO2e, cap is % kg (over by % kg)',
            v_department, v_total, v_cap, (v_total - v_cap);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_cap ON emission_records;
CREATE TRIGGER check_cap
AFTER INSERT ON emission_records
FOR EACH ROW
EXECUTE FUNCTION flag_breach();

-- ---------------------------------------------------------------------------
-- Stored procedure: atomically purchase carbon credits.
-- Validates the department and amount, locks the department row and inserts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE buy_credits(
    p_dept  INT,
    p_qty   NUMERIC,
    p_price NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_department TEXT;
BEGIN
    IF p_qty IS NULL OR p_qty <= 0 THEN
        RAISE EXCEPTION 'Credit quantity must be greater than zero';
    END IF;

    IF p_price IS NULL OR p_price < 0 THEN
        RAISE EXCEPTION 'Price per unit cannot be negative';
    END IF;

    SELECT name INTO v_department
      FROM departments
     WHERE dept_id = p_dept
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Department % does not exist', p_dept;
    END IF;

    INSERT INTO carbon_credits (dept_id, quantity, price_per_unit, txn_type)
    VALUES (p_dept, p_qty, p_price, 'buy');

    RAISE NOTICE 'Purchased % credits for % at % per unit',
        p_qty, v_department, p_price;
END;
$$;

-- ---------------------------------------------------------------------------
-- Transaction example: the procedure call commits as one atomic unit.
-- ---------------------------------------------------------------------------
BEGIN;
    CALL buy_credits(1, 100.00, 12.50);
COMMIT;

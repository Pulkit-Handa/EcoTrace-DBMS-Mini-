-- ===========================================================================
-- EcoTrace — DML demonstration
-- Runs inside a transaction and ROLLS BACK so the demo is repeatable.
-- Covers INSERT, UPDATE, DELETE, JOIN + GROUP BY + HAVING + ORDER BY,
-- aggregate functions and a subquery with IN.
-- ===========================================================================

BEGIN;

-- 1. INSERT ---------------------------------------------------------------
INSERT INTO emission_records (dept_id, user_id, scope, value_kgco2, description)
SELECT d.dept_id, u.user_id, 2, 145.75, 'DML demo: server-room cooling'
FROM departments d
CROSS JOIN users u
WHERE d.name = 'Operations'
  AND u.email = 'bob@eco.com';

-- The AFTER INSERT trigger is now evaluating the Operations cap.

-- 2. UPDATE ---------------------------------------------------------------
UPDATE departments
SET emission_cap = 5500
WHERE name = 'Engineering';

SELECT dept_id, name, emission_cap
FROM departments
ORDER BY dept_id;

-- 3. DELETE ---------------------------------------------------------------
DELETE FROM vendor_reports
WHERE report_id = 3;

-- 4. JOIN + GROUP BY + HAVING + aggregates + ORDER BY ---------------------
SELECT
    d.name,
    e.scope,
    ROUND(AVG(e.value_kgco2), 2) AS avg_emission,
    SUM(e.value_kgco2)           AS total
FROM emission_records e
JOIN departments d ON d.dept_id = e.dept_id
GROUP BY d.name, e.scope
HAVING SUM(e.value_kgco2) > 100
ORDER BY total DESC;

-- 5. Subquery with IN -----------------------------------------------------
SELECT d.name, d.emission_cap
FROM departments d
WHERE d.dept_id IN (
    SELECT e.dept_id
    FROM emission_records e
    WHERE e.recorded_at >= date_trunc('year', CURRENT_DATE)
    GROUP BY e.dept_id
    HAVING SUM(e.value_kgco2) > 3000
)
ORDER BY d.name;

-- Keep the seeded database unchanged after the demo.
ROLLBACK;

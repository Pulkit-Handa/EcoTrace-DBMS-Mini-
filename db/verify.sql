-- ===========================================================================
-- EcoTrace — database verification queries (MySQL 8.0+)
-- Run with:  mysql "$MYSQL_URL" -e "source db/verify.sql"
-- ===========================================================================

-- 1. Five application tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Constraints
SELECT TABLE_NAME AS table_name, CONSTRAINT_NAME AS conname, CONSTRAINT_TYPE AS contype
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, CONSTRAINT_TYPE;

-- 3. Indexes
SELECT TABLE_NAME AS tablename, INDEX_NAME AS indexname
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME;

-- 4. Views
SELECT table_name
FROM information_schema.views
WHERE table_schema = DATABASE()
ORDER BY table_name;

-- 5. Trigger
SELECT EVENT_OBJECT_TABLE AS event_object_table, TRIGGER_NAME AS trigger_name,
       ACTION_TIMING AS action_timing, EVENT_MANIPULATION AS event_manipulation
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE();

-- 6. Stored procedure
SELECT ROUTINE_NAME AS routine_name, ROUTINE_TYPE AS routine_type
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = DATABASE()
  AND ROUTINE_NAME IN ('buy_credits', 'flag_breach')
ORDER BY ROUTINE_NAME;

-- 7. Compliance report
SELECT * FROM compliance_summary ORDER BY utilisation_pct DESC;

-- 8. Department + scope report
SELECT * FROM dept_scope_summary ORDER BY total_emission_kg DESC;

-- 9. Rows per table
SELECT 'departments' AS relation, COUNT(*) FROM departments
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'emission_records', COUNT(*) FROM emission_records
UNION ALL SELECT 'carbon_credits', COUNT(*) FROM carbon_credits
UNION ALL SELECT 'vendor_reports', COUNT(*) FROM vendor_reports;

-- ===========================================================================
-- EcoTrace — database verification queries
-- Run with:  psql "$POSTGRES_URL" -f db/verify.sql
-- ===========================================================================

\echo '== 1. Five application tables =='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo '== 2. Constraints =='
SELECT conrelid::regclass AS table_name, conname, contype
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY table_name, contype;

\echo '== 3. Indexes =='
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo '== 4. Views =='
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

\echo '== 5. Trigger =='
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';

\echo '== 6. Stored procedure =='
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('buy_credits', 'flag_breach');

\echo '== 7. Compliance report =='
SELECT * FROM compliance_summary ORDER BY utilisation_pct DESC;

\echo '== 8. Department + scope report =='
SELECT * FROM dept_scope_summary ORDER BY total_emission_kg DESC;

\echo '== 9. Rows per table =='
SELECT 'departments' AS relation, COUNT(*) FROM departments
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'emission_records', COUNT(*) FROM emission_records
UNION ALL SELECT 'carbon_credits', COUNT(*) FROM carbon_credits
UNION ALL SELECT 'vendor_reports', COUNT(*) FROM vendor_reports;

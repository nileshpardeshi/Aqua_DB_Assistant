-- ============================================================================
-- Aqua DB Copilot — Cleanup Test Data
-- Removes the banking_sim schema and all bulk test data
-- Usage: psql -U aqua_user -d aqua_db -f 04-cleanup-test-data.sql
-- ============================================================================

-- Show current sizes before cleanup
\echo 'Current banking_sim data:'
SELECT
    schemaname || '.' || tablename AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'banking_sim'
ORDER BY n_live_tup DESC;

-- Drop the simulation schema entirely
DROP SCHEMA IF EXISTS banking_sim CASCADE;

\echo '✓ Dropped banking_sim schema and all test data'

-- Reclaim disk space
VACUUM FULL;

\echo '✓ Disk space reclaimed (VACUUM FULL completed)'

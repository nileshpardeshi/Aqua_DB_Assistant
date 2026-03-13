#!/bin/bash
# ============================================================================
# Aqua DB Copilot — Docker PostgreSQL Quick Reference
# Common commands for managing the PostgreSQL container
# ============================================================================

# --- Start/Stop/Restart Container ---
# docker start aqua-postgres
# docker stop aqua-postgres
# docker restart aqua-postgres

# --- Check Container Status ---
# docker ps -a --filter name=aqua-postgres
# docker logs aqua-postgres --tail 50

# --- Connect to PostgreSQL via psql ---
# docker exec -it aqua-postgres psql -U aqua_user -d aqua_db

# --- Run SQL scripts from host ---
# docker exec -i aqua-postgres psql -U aqua_user -d aqua_db < db-scripts/01-create-schema.sql
# docker exec -i aqua-postgres psql -U aqua_user -d aqua_db < db-scripts/02-seed-demo-data.sql
# docker exec -i aqua-postgres psql -U aqua_user -d aqua_db < db-scripts/03-generate-bulk-test-data.sql

# --- Backup Database ---
# docker exec aqua-postgres pg_dump -U aqua_user -d aqua_db > backup_$(date +%Y%m%d_%H%M%S).sql

# --- Restore Database ---
# docker exec -i aqua-postgres psql -U aqua_user -d aqua_db < backup.sql

# --- Check Database Size ---
# docker exec aqua-postgres psql -U aqua_user -d aqua_db -c "SELECT pg_size_pretty(pg_database_size('aqua_db'));"

# --- Check Table Sizes ---
# docker exec aqua-postgres psql -U aqua_user -d aqua_db -c "
#   SELECT schemaname || '.' || tablename AS table_name,
#          pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
#          n_live_tup AS row_count
#   FROM pg_stat_user_tables
#   ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;"

# --- Reset Everything (DANGER: deletes all data) ---
# docker stop aqua-postgres
# docker rm aqua-postgres
# docker volume rm aqua_pgdata
# Then re-run: docker run -d --name aqua-postgres ...

# --- Create Container From Scratch ---
# docker run -d \
#   --name aqua-postgres \
#   -e POSTGRES_USER=aqua_user \
#   -e POSTGRES_PASSWORD=aqua_pass_2026 \
#   -e POSTGRES_DB=aqua_db \
#   -p 5432:5432 \
#   -v aqua_pgdata:/var/lib/postgresql/data \
#   postgres:16-alpine

echo "This is a reference script — run individual commands as needed."

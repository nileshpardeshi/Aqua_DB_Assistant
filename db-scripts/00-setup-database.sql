-- ============================================================================
-- Aqua DB Copilot — Database & Role Setup
-- Run this as PostgreSQL superuser (postgres) to create the database and user
-- Usage: psql -U postgres -f 00-setup-database.sql
-- ============================================================================

-- Create application role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'aqua_user') THEN
    CREATE ROLE aqua_user WITH LOGIN PASSWORD 'aqua_pass_2026';
  END IF;
END
$$;

-- Create database
SELECT 'CREATE DATABASE aqua_db OWNER aqua_user ENCODING ''UTF8'' LC_COLLATE ''en_US.utf8'' LC_CTYPE ''en_US.utf8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aqua_db')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE aqua_db TO aqua_user;

-- Connect to aqua_db and set up schema permissions
\c aqua_db

GRANT ALL ON SCHEMA public TO aqua_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO aqua_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO aqua_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO aqua_user;

-- Enable extensions commonly needed for enterprise apps
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Encryption functions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Trigram matching for search

\echo '✓ Database aqua_db created with user aqua_user'

-- ============================================================================
-- Aqua DB Copilot — Enterprise Demo Seed Data
-- Populates 3 projects with banking, e-commerce, and analytics schemas
-- Usage: psql -U aqua_user -d aqua_db -f 02-seed-demo-data.sql
-- ============================================================================

-- Deterministic UUIDs for cross-references
-- Project IDs
\set BANKING_ID   '10000000-0000-4000-8000-000000000001'
\set ECOMMERCE_ID '10000000-0000-4000-8000-000000000002'
\set ANALYTICS_ID '10000000-0000-4000-8000-000000000003'

-- Table IDs for Banking project
\set TBL_CUSTOMERS    '20000000-0000-4000-8000-000000000001'
\set TBL_ACCOUNTS     '20000000-0000-4000-8000-000000000002'
\set TBL_TRANSACTIONS '20000000-0000-4000-8000-000000000003'
\set TBL_CARDS        '20000000-0000-4000-8000-000000000004'
\set TBL_LOANS        '20000000-0000-4000-8000-000000000005'
\set TBL_AUDIT_TRAIL  '20000000-0000-4000-8000-000000000006'
\set TBL_KYC          '20000000-0000-4000-8000-000000000007'
\set TBL_BENEFICIARIES '20000000-0000-4000-8000-000000000008'

BEGIN;

-- ========================================================================
-- 1. PROJECTS
-- ========================================================================

INSERT INTO "Project" ("id", "name", "description", "dialect", "status", "schemas", "updatedAt") VALUES
(:'BANKING_ID',   'Banking Core System',       'Core banking platform — accounts, transactions, customers, loans, cards, KYC, and audit trail for enterprise payment processing.', 'postgresql', 'active', '["public","auth","audit","kyc"]', NOW()),
(:'ECOMMERCE_ID', 'E-Commerce Platform',       'Multi-tenant e-commerce database with product catalog, orders, inventory, and real-time pricing engine.',                         'mysql',      'active', '["public","catalog","orders"]',   NOW()),
(:'ANALYTICS_ID', 'Analytics Data Warehouse',  'Snowflake-based analytics warehouse for BI, customer segmentation, and revenue dashboards.',                                     'snowflake',  'active', '["public","marts","staging"]',    NOW())
ON CONFLICT ("id") DO NOTHING;

-- ========================================================================
-- 2. TABLE METADATA (Banking Project — 8 core tables)
-- ========================================================================

INSERT INTO "TableMetadata" ("id", "projectId", "schemaName", "tableName", "tableType", "description", "estimatedRows", "updatedAt") VALUES
(:'TBL_CUSTOMERS',     :'BANKING_ID', 'public', 'customers',     'table', 'Core customer master — personal info, KYC status, risk rating',               2500000, NOW()),
(:'TBL_ACCOUNTS',      :'BANKING_ID', 'public', 'accounts',      'table', 'Bank accounts — savings, current, fixed deposit, recurring deposit',          4200000, NOW()),
(:'TBL_TRANSACTIONS',  :'BANKING_ID', 'public', 'transactions',  'table', 'Financial transactions — debits, credits, transfers, payments',              85000000, NOW()),
(:'TBL_CARDS',         :'BANKING_ID', 'public', 'cards',         'table', 'Debit and credit cards linked to accounts',                                  3100000, NOW()),
(:'TBL_LOANS',         :'BANKING_ID', 'public', 'loans',         'table', 'Loan accounts — personal, home, auto, education, business',                  1800000, NOW()),
(:'TBL_AUDIT_TRAIL',   :'BANKING_ID', 'audit',  'audit_trail',   'table', 'Regulatory audit trail — every data modification logged',                  250000000, NOW()),
(:'TBL_KYC',           :'BANKING_ID', 'kyc',    'kyc_documents', 'table', 'KYC verification documents — Aadhaar, PAN, passport, utility bills',        5000000, NOW()),
(:'TBL_BENEFICIARIES', :'BANKING_ID', 'public', 'beneficiaries', 'table', 'Transfer beneficiaries linked to customer accounts',                        7500000, NOW())
ON CONFLICT ("id") DO NOTHING;

-- ========================================================================
-- 3. COLUMN METADATA (Banking — customers table)
-- ========================================================================

INSERT INTO "ColumnMetadata" ("id", "tableId", "columnName", "dataType", "normalizedType", "ordinalPosition", "isNullable", "isPrimaryKey", "isUnique", "sensitivityTag") VALUES
(gen_random_uuid(), :'TBL_CUSTOMERS', 'customer_id',    'UUID',         'uuid',      1, false, true,  true,  NULL),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'first_name',     'VARCHAR(100)', 'varchar',   2, false, false, false, 'PII'),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'last_name',      'VARCHAR(100)', 'varchar',   3, false, false, false, 'PII'),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'email',          'VARCHAR(255)', 'varchar',   4, false, false, true,  'PII'),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'phone',          'VARCHAR(20)',  'varchar',   5, true,  false, false, 'PII'),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'date_of_birth',  'DATE',         'date',      6, false, false, false, 'PII'),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'pan_number',     'VARCHAR(10)',  'varchar',   7, true,  false, true,  'Financial'),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'aadhaar_hash',   'VARCHAR(64)',  'varchar',   8, true,  false, false, 'PII'),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'kyc_status',     'VARCHAR(20)',  'varchar',   9, false, false, false, NULL),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'risk_rating',    'VARCHAR(10)',  'varchar',  10, false, false, false, NULL),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'address_line1',  'VARCHAR(500)', 'varchar',  11, true,  false, false, 'PII'),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'city',           'VARCHAR(100)', 'varchar',  12, true,  false, false, NULL),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'state',          'VARCHAR(100)', 'varchar',  13, true,  false, false, NULL),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'postal_code',    'VARCHAR(10)',  'varchar',  14, true,  false, false, NULL),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'country',        'VARCHAR(3)',   'varchar',  15, false, false, false, NULL),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'status',         'VARCHAR(20)',  'varchar',  16, false, false, false, NULL),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'created_at',     'TIMESTAMPTZ',  'timestamp',17, false, false, false, NULL),
(gen_random_uuid(), :'TBL_CUSTOMERS', 'updated_at',     'TIMESTAMPTZ',  'timestamp',18, false, false, false, NULL);

-- Column metadata for accounts table
INSERT INTO "ColumnMetadata" ("id", "tableId", "columnName", "dataType", "normalizedType", "ordinalPosition", "isNullable", "isPrimaryKey", "isUnique", "sensitivityTag") VALUES
(gen_random_uuid(), :'TBL_ACCOUNTS', 'account_id',      'UUID',           'uuid',      1, false, true,  true,  NULL),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'customer_id',     'UUID',           'uuid',      2, false, false, false, NULL),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'account_number',  'VARCHAR(20)',    'varchar',   3, false, false, true,  'Financial'),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'account_type',    'VARCHAR(30)',    'varchar',   4, false, false, false, NULL),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'balance',         'NUMERIC(18,2)', 'decimal',   5, false, false, false, 'Financial'),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'currency',        'VARCHAR(3)',     'varchar',   6, false, false, false, NULL),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'branch_code',     'VARCHAR(10)',    'varchar',   7, false, false, false, NULL),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'ifsc_code',       'VARCHAR(11)',    'varchar',   8, false, false, false, NULL),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'status',          'VARCHAR(20)',    'varchar',   9, false, false, false, NULL),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'opened_at',       'TIMESTAMPTZ',   'timestamp',10, false, false, false, NULL),
(gen_random_uuid(), :'TBL_ACCOUNTS', 'closed_at',       'TIMESTAMPTZ',   'timestamp',11, true,  false, false, NULL);

-- Column metadata for transactions table
INSERT INTO "ColumnMetadata" ("id", "tableId", "columnName", "dataType", "normalizedType", "ordinalPosition", "isNullable", "isPrimaryKey", "isUnique", "sensitivityTag") VALUES
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'transaction_id',   'UUID',           'uuid',      1, false, true,  true,  NULL),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'account_id',       'UUID',           'uuid',      2, false, false, false, NULL),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'transaction_type', 'VARCHAR(30)',    'varchar',   3, false, false, false, NULL),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'amount',           'NUMERIC(18,2)', 'decimal',   4, false, false, false, 'Financial'),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'currency',         'VARCHAR(3)',     'varchar',   5, false, false, false, NULL),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'description',      'VARCHAR(500)',   'varchar',   6, true,  false, false, NULL),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'reference_number', 'VARCHAR(50)',    'varchar',   7, false, false, true,  NULL),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'status',           'VARCHAR(20)',    'varchar',   8, false, false, false, NULL),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'channel',          'VARCHAR(30)',    'varchar',   9, false, false, false, NULL),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'ip_address',       'VARCHAR(45)',    'varchar',  10, true,  false, false, NULL),
(gen_random_uuid(), :'TBL_TRANSACTIONS', 'created_at',       'TIMESTAMPTZ',   'timestamp',11, false, false, false, NULL);

-- ========================================================================
-- 4. RELATIONSHIPS
-- ========================================================================

INSERT INTO "RelationshipMetadata" ("id", "sourceTableId", "targetTableId", "relationshipType", "sourceColumns", "targetColumns", "constraintName", "onDelete", "onUpdate") VALUES
(gen_random_uuid(), :'TBL_ACCOUNTS',      :'TBL_CUSTOMERS',    'many-to-one', 'customer_id',  'customer_id',  'fk_accounts_customer',      'RESTRICT', 'CASCADE'),
(gen_random_uuid(), :'TBL_TRANSACTIONS',   :'TBL_ACCOUNTS',     'many-to-one', 'account_id',   'account_id',   'fk_transactions_account',   'RESTRICT', 'CASCADE'),
(gen_random_uuid(), :'TBL_CARDS',          :'TBL_ACCOUNTS',     'many-to-one', 'account_id',   'account_id',   'fk_cards_account',          'CASCADE',  'CASCADE'),
(gen_random_uuid(), :'TBL_LOANS',          :'TBL_CUSTOMERS',    'many-to-one', 'customer_id',  'customer_id',  'fk_loans_customer',         'RESTRICT', 'CASCADE'),
(gen_random_uuid(), :'TBL_KYC',           :'TBL_CUSTOMERS',    'many-to-one', 'customer_id',  'customer_id',  'fk_kyc_customer',           'CASCADE',  'CASCADE'),
(gen_random_uuid(), :'TBL_BENEFICIARIES', :'TBL_CUSTOMERS',    'many-to-one', 'customer_id',  'customer_id',  'fk_beneficiaries_customer', 'CASCADE',  'CASCADE');

-- ========================================================================
-- 5. DATA LIFECYCLE RULES (Banking-grade retention policies)
-- ========================================================================

INSERT INTO "DataLifecycleRule" ("id", "projectId", "ruleName", "ruleType", "targetTable", "targetColumns", "configuration", "isActive", "updatedAt") VALUES
(gen_random_uuid(), :'BANKING_ID',
 'Transaction Archive — 7 Year Retention', 'retention', 'transactions', NULL,
 '{"retentionDays":2555,"dateColumn":"created_at","batchSize":10000,"conditions":[{"column":"status","operator":"IN","value":"completed,reversed,cancelled"}],"dialect":"postgresql","safetyOptions":{"backupBeforePurge":true,"cascadeDelete":false,"notifyOnExecution":true},"complianceNote":"RBI mandate: 7-year transaction record retention (Master Direction on KYC 2016)"}',
 true, NOW()),

(gen_random_uuid(), :'BANKING_ID',
 'Audit Trail — 10 Year Regulatory Retention', 'retention', 'audit_trail', NULL,
 '{"retentionDays":3650,"dateColumn":"created_at","batchSize":50000,"conditions":[],"dialect":"postgresql","safetyOptions":{"backupBeforePurge":true,"cascadeDelete":false,"notifyOnExecution":true},"complianceNote":"RBI/SEBI mandate: 10-year audit trail retention for all financial operations"}',
 true, NOW()),

(gen_random_uuid(), :'BANKING_ID',
 'KYC Documents — 8 Year Post-Closure', 'retention', 'kyc_documents', NULL,
 '{"retentionDays":2920,"dateColumn":"created_at","batchSize":5000,"conditions":[{"column":"status","operator":"=","value":"verified"},{"column":"customer_status","operator":"=","value":"closed"}],"dialect":"postgresql","safetyOptions":{"backupBeforePurge":true,"cascadeDelete":true,"notifyOnExecution":true},"complianceNote":"PMLA Act: KYC records must be maintained for 8 years after business relationship ends"}',
 true, NOW()),

(gen_random_uuid(), :'BANKING_ID',
 'Failed Transactions — 90 Day Cleanup', 'deletion', 'transactions', NULL,
 '{"retentionDays":90,"dateColumn":"created_at","batchSize":25000,"conditions":[{"column":"status","operator":"=","value":"failed"},{"column":"amount","operator":"=","value":"0"}],"dialect":"postgresql","safetyOptions":{"backupBeforePurge":false,"cascadeDelete":false,"notifyOnExecution":true},"complianceNote":"Internal policy: zero-amount failed transactions are safe to delete after 90 days"}',
 true, NOW()),

(gen_random_uuid(), :'BANKING_ID',
 'Session Logs — 30 Day Purge', 'deletion', 'session_logs', NULL,
 '{"retentionDays":30,"dateColumn":"created_at","batchSize":50000,"conditions":[],"dialect":"postgresql","safetyOptions":{"backupBeforePurge":false,"cascadeDelete":false,"notifyOnExecution":false},"complianceNote":"Internal policy: user session logs older than 30 days can be purged"}',
 true, NOW()),

(gen_random_uuid(), :'BANKING_ID',
 'PII Data Masking — Closed Accounts', 'masking', 'customers', '["first_name","last_name","email","phone","aadhaar_hash","pan_number","address_line1"]',
 '{"retentionDays":365,"dateColumn":"updated_at","batchSize":1000,"conditions":[{"column":"status","operator":"=","value":"closed"}],"dialect":"postgresql","maskingStrategy":"hash","safetyOptions":{"backupBeforePurge":true,"cascadeDelete":false,"notifyOnExecution":true},"complianceNote":"DPDP Act 2023: Personal data of closed accounts must be anonymized within 1 year of account closure"}',
 true, NOW());

-- ========================================================================
-- 6. SAVED QUERIES (Banking common queries)
-- ========================================================================

INSERT INTO "SavedQuery" ("id", "projectId", "title", "description", "sql", "dialect", "category", "isFavorite", "updatedAt") VALUES
(gen_random_uuid(), :'BANKING_ID',
 'High-Value Transactions Today',
 'All transactions above 10 lakhs from today for AML review',
 'SELECT t.transaction_id, t.amount, t.currency, t.transaction_type, t.channel,
       c.first_name || '' '' || c.last_name AS customer_name, a.account_number
FROM transactions t
JOIN accounts a ON t.account_id = a.account_id
JOIN customers c ON a.customer_id = c.customer_id
WHERE t.created_at >= CURRENT_DATE
  AND t.amount >= 1000000
ORDER BY t.amount DESC;',
 'postgresql', 'compliance', true, NOW()),

(gen_random_uuid(), :'BANKING_ID',
 'Dormant Accounts Report',
 'Accounts with no transactions in the last 2 years',
 'SELECT a.account_number, a.account_type, a.balance, a.currency,
       c.first_name || '' '' || c.last_name AS customer_name,
       MAX(t.created_at) AS last_activity
FROM accounts a
JOIN customers c ON a.customer_id = c.customer_id
LEFT JOIN transactions t ON a.account_id = t.account_id
WHERE a.status = ''active''
GROUP BY a.account_id, a.account_number, a.account_type, a.balance, a.currency, c.first_name, c.last_name
HAVING MAX(t.created_at) < NOW() - INTERVAL ''2 years'' OR MAX(t.created_at) IS NULL
ORDER BY a.balance DESC;',
 'postgresql', 'operations', true, NOW()),

(gen_random_uuid(), :'BANKING_ID',
 'Daily Transaction Summary',
 'Aggregate transaction volumes and amounts by type for the day',
 'SELECT transaction_type, status, COUNT(*) AS tx_count,
       SUM(amount) AS total_amount, AVG(amount) AS avg_amount,
       MIN(amount) AS min_amount, MAX(amount) AS max_amount
FROM transactions
WHERE created_at >= CURRENT_DATE
GROUP BY transaction_type, status
ORDER BY total_amount DESC;',
 'postgresql', 'reporting', false, NOW());

-- ========================================================================
-- 7. DATABASE CONNECTION (self-reference for testing)
-- ========================================================================

-- Note: passwordEncrypted would normally be AES-256-GCM encrypted.
-- For seed data, using a placeholder that the app will re-encrypt on first use.
INSERT INTO "DatabaseConnection" ("id", "projectId", "name", "dialect", "host", "port", "database", "username", "passwordEncrypted", "sslEnabled", "isActive", "createdAt") VALUES
(gen_random_uuid(), :'BANKING_ID',
 'Banking Dev PostgreSQL', 'postgresql', 'localhost', 5432, 'aqua_db', 'aqua_user',
 'PLACEHOLDER:aqua_pass_2026',
 false, true, NOW());

COMMIT;

\echo '✓ Demo seed data inserted: 3 projects, 8 tables, 40+ columns, 6 lifecycle rules, 3 saved queries'

-- ============================================================================
-- Aqua DB Copilot — Bulk Test Data Generator
-- Generates millions of rows for testing purge, migration, and performance
-- Usage: psql -U aqua_user -d aqua_db -f 03-generate-bulk-test-data.sql
--
-- WARNING: This creates real tables with millions of rows in your database.
--          Expected disk usage: ~2-5 GB depending on row counts.
--          Expected run time:   ~2-5 minutes on modern hardware.
-- ============================================================================

-- Create a dedicated schema for simulation data
CREATE SCHEMA IF NOT EXISTS banking_sim;

-- ============================================================
-- Drop existing tables (clean slate)
-- ============================================================

DROP TABLE IF EXISTS banking_sim.cards CASCADE;
DROP TABLE IF EXISTS banking_sim.audit_trail CASCADE;
DROP TABLE IF EXISTS banking_sim.transactions CASCADE;
DROP TABLE IF EXISTS banking_sim.accounts CASCADE;
DROP TABLE IF EXISTS banking_sim.customers CASCADE;

-- ============================================================
-- 1. CUSTOMERS (2 million rows)
-- ============================================================

CREATE TABLE banking_sim.customers (
    customer_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    phone          VARCHAR(20),
    date_of_birth  DATE NOT NULL,
    pan_number     VARCHAR(10),
    aadhaar_hash   VARCHAR(64),
    kyc_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    risk_rating    VARCHAR(10) NOT NULL DEFAULT 'low',
    address_line1  VARCHAR(500),
    city           VARCHAR(100),
    state          VARCHAR(100),
    postal_code    VARCHAR(10),
    country        VARCHAR(3) NOT NULL DEFAULT 'IND',
    status         VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customers_status_check CHECK (status IN ('active', 'inactive', 'closed', 'suspended', 'frozen')),
    CONSTRAINT customers_kyc_check CHECK (kyc_status IN ('pending', 'in_progress', 'verified', 'rejected', 'expired')),
    CONSTRAINT customers_risk_check CHECK (risk_rating IN ('low', 'medium', 'high', 'critical'))
);

INSERT INTO banking_sim.customers (
    customer_id, first_name, last_name, email, phone, date_of_birth,
    pan_number, kyc_status, risk_rating, city, state, postal_code, status, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    (ARRAY['Rahul','Priya','Amit','Sneha','Vikram','Anjali','Suresh','Kavita','Rajesh','Pooja',
           'Arun','Meena','Sanjay','Deepa','Ravi','Neha','Vijay','Sunita','Manoj','Asha'])[floor(random()*20+1)::int],
    (ARRAY['Sharma','Patel','Kumar','Singh','Reddy','Gupta','Verma','Joshi','Nair','Rao',
           'Iyer','Shah','Mehta','Das','Chatterjee','Banerjee','Deshmukh','Kulkarni','Mishra','Agarwal'])[floor(random()*20+1)::int],
    'user' || n || '@' || (ARRAY['gmail.com','yahoo.com','outlook.com','icici.com','hdfc.com'])[floor(random()*5+1)::int],
    '+91' || (7000000000 + floor(random()*3000000000)::bigint)::text,
    DATE '1960-01-01' + (random() * 15000)::int,
    UPPER(chr(65 + floor(random()*26)::int) || chr(65 + floor(random()*26)::int) ||
          chr(65 + floor(random()*26)::int) || chr(65 + floor(random()*26)::int) || chr(65 + floor(random()*26)::int) ||
          lpad(floor(random()*10000)::text, 4, '0') || chr(65 + floor(random()*26)::int)),
    (ARRAY['verified','verified','verified','verified','pending','in_progress','rejected','expired'])[floor(random()*8+1)::int],
    (ARRAY['low','low','low','medium','medium','high','critical'])[floor(random()*7+1)::int],
    (ARRAY['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad','Jaipur','Lucknow',
           'Indore','Nagpur','Surat','Chandigarh','Kochi'])[floor(random()*15+1)::int],
    (ARRAY['Maharashtra','Delhi','Karnataka','Telangana','Tamil Nadu','West Bengal','Maharashtra','Gujarat','Rajasthan','UP',
           'MP','Maharashtra','Gujarat','Punjab','Kerala'])[floor(random()*15+1)::int],
    lpad(floor(random()*999999)::text, 6, '0'),
    (ARRAY['active','active','active','active','active','inactive','closed','suspended'])[floor(random()*8+1)::int],
    NOW() - (random() * 1825)::int * INTERVAL '1 day',
    NOW() - (random() * 365)::int * INTERVAL '1 day'
FROM generate_series(1, 2000000) AS n;

CREATE INDEX idx_cust_status ON banking_sim.customers(status);
CREATE INDEX idx_cust_kyc ON banking_sim.customers(kyc_status);
CREATE INDEX idx_cust_created ON banking_sim.customers(created_at);
CREATE INDEX idx_cust_city ON banking_sim.customers(city);

\echo '✓ Created 2,000,000 customers'

-- ============================================================
-- 2. ACCOUNTS (4 million rows — ~2 per customer)
-- ============================================================

CREATE TABLE banking_sim.accounts (
    account_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    UUID NOT NULL REFERENCES banking_sim.customers(customer_id),
    account_number VARCHAR(20) NOT NULL,
    account_type   VARCHAR(30) NOT NULL,
    balance        NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    currency       VARCHAR(3) NOT NULL DEFAULT 'INR',
    branch_code    VARCHAR(10) NOT NULL,
    ifsc_code      VARCHAR(11) NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'active',
    opened_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at      TIMESTAMPTZ,
    CONSTRAINT accounts_type_check CHECK (account_type IN ('savings', 'current', 'fixed_deposit', 'recurring_deposit', 'salary', 'nre', 'nro')),
    CONSTRAINT accounts_status_check CHECK (status IN ('active', 'dormant', 'frozen', 'closed')),
    CONSTRAINT accounts_balance_check CHECK (balance >= -100000)
);

-- Use ROW_NUMBER to guarantee unique account numbers
INSERT INTO banking_sim.accounts (
    account_id, customer_id, account_number, account_type, balance,
    currency, branch_code, ifsc_code, status, opened_at, closed_at
)
SELECT
    gen_random_uuid(),
    customer_id,
    'ACC' || lpad(ROW_NUMBER() OVER ()::text, 12, '0'),
    (ARRAY['savings','savings','current','fixed_deposit','recurring_deposit','salary','nre'])[floor(random()*7+1)::int],
    round((random() * 5000000)::numeric, 2),
    'INR',
    'BR' || lpad(floor(random()*9999)::text, 4, '0'),
    'AQUA0' || lpad(floor(random()*999999)::text, 6, '0'),
    (ARRAY['active','active','active','active','active','active','dormant','frozen','closed'])[floor(random()*9+1)::int],
    created_at + (random() * 30)::int * INTERVAL '1 day',
    CASE WHEN random() > 0.95 THEN created_at + (random() * 1000)::int * INTERVAL '1 day' ELSE NULL END
FROM banking_sim.customers
CROSS JOIN generate_series(1, 2) AS s(n)
ORDER BY random()
LIMIT 4000000;

ALTER TABLE banking_sim.accounts ADD CONSTRAINT accounts_account_number_key UNIQUE (account_number);

CREATE INDEX idx_acct_customer ON banking_sim.accounts(customer_id);
CREATE INDEX idx_acct_status ON banking_sim.accounts(status);
CREATE INDEX idx_acct_opened ON banking_sim.accounts(opened_at);
CREATE INDEX idx_acct_type ON banking_sim.accounts(account_type);

\echo '✓ Created 4,000,000 accounts'

-- ============================================================
-- 3. TRANSACTIONS (10 million rows — inserted in batches)
-- ============================================================

CREATE TABLE banking_sim.transactions (
    transaction_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       UUID NOT NULL REFERENCES banking_sim.accounts(account_id),
    transaction_type VARCHAR(30) NOT NULL,
    amount           NUMERIC(18,2) NOT NULL,
    currency         VARCHAR(3) NOT NULL DEFAULT 'INR',
    description      VARCHAR(500),
    reference_number VARCHAR(50) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'completed',
    channel          VARCHAR(30) NOT NULL,
    ip_address       VARCHAR(45),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tx_type_check CHECK (transaction_type IN ('credit','debit','transfer','payment','refund','reversal','interest','fee','emi')),
    CONSTRAINT tx_status_check CHECK (status IN ('pending','processing','completed','failed','reversed','cancelled')),
    CONSTRAINT tx_channel_check CHECK (channel IN ('net_banking','mobile_app','upi','neft','rtgs','imps','atm','branch','auto'))
);

-- Collect account IDs into a temp table for fast random lookup
CREATE TEMP TABLE _acct_ids AS SELECT account_id FROM banking_sim.accounts;
CREATE INDEX ON _acct_ids(account_id);

-- Insert 10M in 5 batches of 2M each
DO $$
DECLARE
    batch_num INT;
    acct_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO acct_count FROM _acct_ids;
    RAISE NOTICE 'Generating transactions against % accounts...', acct_count;

    FOR batch_num IN 1..5 LOOP
        INSERT INTO banking_sim.transactions (
            transaction_id, account_id, transaction_type, amount, currency,
            description, reference_number, status, channel, ip_address, created_at
        )
        SELECT
            gen_random_uuid(),
            (SELECT account_id FROM _acct_ids OFFSET floor(random() * acct_count)::int LIMIT 1),
            (ARRAY['credit','debit','debit','transfer','payment','refund','interest','fee','emi'])[floor(random()*9+1)::int],
            round((random() * 500000)::numeric, 2),
            'INR',
            (ARRAY['Salary credit','ATM withdrawal','UPI payment','NEFT transfer','EMI payment',
                   'Bill payment','Merchant payment','Interest credit','Service fee','Refund processed',
                   'Insurance premium','Mutual fund SIP','Loan EMI auto-debit','Cash deposit','Cheque clearing'])[floor(random()*15+1)::int],
            'TXN' || lpad(((batch_num - 1) * 2000000 + n)::text, 15, '0'),
            (ARRAY['completed','completed','completed','completed','completed','completed','completed','failed','pending','reversed','cancelled'])[floor(random()*11+1)::int],
            (ARRAY['net_banking','mobile_app','mobile_app','upi','upi','upi','neft','rtgs','imps','atm','branch','auto'])[floor(random()*12+1)::int],
            (floor(random()*255)::int || '.' || floor(random()*255)::int || '.' || floor(random()*255)::int || '.' || floor(random()*255)::int),
            NOW() - (random() * 1095)::int * INTERVAL '1 day' - (random() * 86400)::int * INTERVAL '1 second'
        FROM generate_series(1, 2000000) AS n;

        RAISE NOTICE 'Batch % of 5 complete (% transactions)', batch_num, batch_num * 2000000;
    END LOOP;
END $$;

DROP TABLE IF EXISTS _acct_ids;

CREATE INDEX idx_tx_account ON banking_sim.transactions(account_id);
CREATE INDEX idx_tx_status ON banking_sim.transactions(status);
CREATE INDEX idx_tx_created ON banking_sim.transactions(created_at);
CREATE INDEX idx_tx_type ON banking_sim.transactions(transaction_type);
CREATE INDEX idx_tx_amount ON banking_sim.transactions(amount);
CREATE INDEX idx_tx_channel ON banking_sim.transactions(channel);
CREATE INDEX idx_tx_reference ON banking_sim.transactions(reference_number);
CREATE INDEX idx_tx_status_created ON banking_sim.transactions(status, created_at);

\echo '✓ Created 10,000,000 transactions'

-- ============================================================
-- 4. AUDIT TRAIL (5 million rows)
-- ============================================================

CREATE TABLE banking_sim.audit_trail (
    audit_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type    VARCHAR(50) NOT NULL,
    entity_id      UUID NOT NULL,
    action         VARCHAR(30) NOT NULL,
    old_values     TEXT,
    new_values     TEXT,
    performed_by   VARCHAR(100) NOT NULL,
    ip_address     VARCHAR(45),
    user_agent     VARCHAR(500),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_action_check CHECK (action IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','VIEW','EXPORT','APPROVE','REJECT'))
);

INSERT INTO banking_sim.audit_trail (
    audit_id, entity_type, entity_id, action, old_values, new_values,
    performed_by, ip_address, created_at
)
SELECT
    gen_random_uuid(),
    (ARRAY['customer','account','transaction','card','loan','kyc_document','beneficiary'])[floor(random()*7+1)::int],
    gen_random_uuid(),
    (ARRAY['INSERT','UPDATE','UPDATE','UPDATE','DELETE','VIEW','VIEW','EXPORT','LOGIN','LOGOUT','APPROVE','REJECT'])[floor(random()*12+1)::int],
    CASE WHEN random() > 0.5 THEN '{"status":"active","balance":' || round((random()*100000)::numeric,2)::text || '}' ELSE NULL END,
    '{"status":"' || (ARRAY['active','inactive','closed','updated'])[floor(random()*4+1)::int] || '"}',
    'user_' || lpad(floor(random()*500)::text, 3, '0') || '@aquabank.com',
    (floor(random()*255)::int || '.' || floor(random()*255)::int || '.' || floor(random()*255)::int || '.' || floor(random()*255)::int),
    NOW() - (random() * 1825)::int * INTERVAL '1 day' - (random() * 86400)::int * INTERVAL '1 second'
FROM generate_series(1, 5000000);

CREATE INDEX idx_audit_entity ON banking_sim.audit_trail(entity_type, entity_id);
CREATE INDEX idx_audit_action ON banking_sim.audit_trail(action);
CREATE INDEX idx_audit_created ON banking_sim.audit_trail(created_at);
CREATE INDEX idx_audit_performer ON banking_sim.audit_trail(performed_by);
CREATE INDEX idx_audit_action_created ON banking_sim.audit_trail(action, created_at);

\echo '✓ Created 5,000,000 audit trail records'

-- ============================================================
-- 5. CARDS (3 million rows)
-- ============================================================

CREATE TABLE banking_sim.cards (
    card_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES banking_sim.accounts(account_id),
    card_number_hash VARCHAR(64) NOT NULL,
    card_type       VARCHAR(20) NOT NULL,
    card_network    VARCHAR(20) NOT NULL,
    expiry_date     DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    daily_limit     NUMERIC(12,2) NOT NULL DEFAULT 100000.00,
    international_enabled BOOLEAN NOT NULL DEFAULT false,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blocked_at      TIMESTAMPTZ,
    CONSTRAINT cards_type_check CHECK (card_type IN ('debit', 'credit', 'prepaid', 'virtual')),
    CONSTRAINT cards_network_check CHECK (card_network IN ('visa', 'mastercard', 'rupay', 'amex')),
    CONSTRAINT cards_status_check CHECK (status IN ('active', 'blocked', 'expired', 'cancelled', 'replaced'))
);

INSERT INTO banking_sim.cards (
    card_id, account_id, card_number_hash, card_type, card_network,
    expiry_date, status, daily_limit, international_enabled, issued_at
)
SELECT
    gen_random_uuid(),
    account_id,
    md5(random()::text || ROW_NUMBER() OVER ()::text),
    (ARRAY['debit','debit','credit','credit','prepaid','virtual'])[floor(random()*6+1)::int],
    (ARRAY['visa','visa','mastercard','mastercard','rupay','rupay','rupay','amex'])[floor(random()*8+1)::int],
    CURRENT_DATE + (floor(random()*1460)::int * INTERVAL '1 day'),
    (ARRAY['active','active','active','active','blocked','expired','cancelled'])[floor(random()*7+1)::int],
    (ARRAY[50000,100000,200000,500000,1000000])[floor(random()*5+1)::int]::numeric,
    random() > 0.7,
    opened_at + (random() * 60)::int * INTERVAL '1 day'
FROM banking_sim.accounts
ORDER BY random()
LIMIT 3000000;

CREATE INDEX idx_cards_account ON banking_sim.cards(account_id);
CREATE INDEX idx_cards_status ON banking_sim.cards(status);
CREATE INDEX idx_cards_expiry ON banking_sim.cards(expiry_date);

\echo '✓ Created 3,000,000 cards'

-- ============================================================
-- ANALYZE all tables for optimal query planning
-- ============================================================

ANALYZE banking_sim.customers;
ANALYZE banking_sim.accounts;
ANALYZE banking_sim.transactions;
ANALYZE banking_sim.audit_trail;
ANALYZE banking_sim.cards;

-- ============================================================
-- SUMMARY
-- ============================================================

\echo ''
\echo '═══════════════════════════════════════════════════════════'
\echo '  Bulk Test Data Generation Complete'
\echo '═══════════════════════════════════════════════════════════'

SELECT
    schemaname || '.' || relname AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS total_size,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'banking_sim'
ORDER BY n_live_tup DESC;

SELECT
    'TOTAL' AS label,
    pg_size_pretty(SUM(pg_total_relation_size(schemaname || '.' || relname))::bigint) AS total_size,
    SUM(n_live_tup) AS total_rows
FROM pg_stat_user_tables
WHERE schemaname = 'banking_sim';

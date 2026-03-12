// ---------------------------------------------------------------------------
// Seed Script — Populates demo data for all pages of Aqua DB Copilot
// Run:  pnpm db:seed  (or tsx prisma/seed.ts)
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { config } from 'dotenv';

// Load .env from server root
config();

const prisma = new PrismaClient();

// ── Encryption helper (mirror of src/utils/crypto.ts) ──────────────────────
// We duplicate here so the seed script is self-contained (no env import needed)
function encrypt(plaintext: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY ?? 'aqua-db-default-encryption-key-seed!!';
  const key = crypto.scryptSync(encryptionKey, 'aqua-db-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted].join(':');
}

// ── Deterministic IDs for cross-references ─────────────────────────────────
const PROJECT_IDS = {
  banking: '10000000-0000-4000-8000-000000000001',
  ecommerce: '10000000-0000-4000-8000-000000000002',
  analytics: '10000000-0000-4000-8000-000000000003',
};

async function main() {
  console.log('Seeding Aqua DB Copilot demo data...\n');

  // Clear existing data (in reverse dependency order)
  await prisma.aIMessage.deleteMany();
  await prisma.aIConversation.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.dataLifecycleRule.deleteMany();
  await prisma.migration.deleteMany();
  await prisma.performanceRun.deleteMany();
  await prisma.queryExecution.deleteMany();
  await prisma.savedQuery.deleteMany();
  await prisma.relationshipMetadata.deleteMany();
  await prisma.constraintMetadata.deleteMany();
  await prisma.indexMetadata.deleteMany();
  await prisma.columnMetadata.deleteMany();
  await prisma.tableMetadata.deleteMany();
  await prisma.schemaSnapshot.deleteMany();
  await prisma.fileParseResult.deleteMany();
  await prisma.projectFile.deleteMany();
  await prisma.databaseConnection.deleteMany();
  await prisma.project.deleteMany();

  console.log('  Cleared existing data.');

  // ========================================================================
  // 1. PROJECTS
  // ========================================================================

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        id: PROJECT_IDS.banking,
        name: 'Banking Core System',
        description:
          'Core banking platform database schema — accounts, transactions, customers, loans, and card management modules for enterprise payment processing.',
        dialect: 'postgresql',
        status: 'active',
      },
    }),
    prisma.project.create({
      data: {
        id: PROJECT_IDS.ecommerce,
        name: 'E-Commerce Platform',
        description:
          'Multi-tenant e-commerce database with product catalog, orders, inventory management, and real-time pricing engine.',
        dialect: 'mysql',
        status: 'active',
      },
    }),
    prisma.project.create({
      data: {
        id: PROJECT_IDS.analytics,
        name: 'Analytics Data Warehouse',
        description:
          'Snowflake-based analytics warehouse for business intelligence, customer segmentation, and revenue dashboards.',
        dialect: 'snowflake',
        status: 'active',
      },
    }),
  ]);

  console.log(`  Created ${projects.length} projects.`);

  // ========================================================================
  // 2. SCHEMA — Banking Core (PostgreSQL) — 8 tables with full columns
  // ========================================================================

  const bankingTables = await createBankingSchema(PROJECT_IDS.banking);
  console.log(`  Created ${bankingTables.length} tables for Banking Core.`);

  // ========================================================================
  // 3. SCHEMA — E-Commerce (MySQL) — 6 tables
  // ========================================================================

  const ecommerceTables = await createEcommerceSchema(PROJECT_IDS.ecommerce);
  console.log(`  Created ${ecommerceTables.length} tables for E-Commerce.`);

  // ========================================================================
  // 4. SAVED QUERIES + EXECUTIONS
  // ========================================================================

  await seedQueries(PROJECT_IDS.banking);
  await seedQueries(PROJECT_IDS.ecommerce);
  console.log('  Created saved queries and execution history.');

  // ========================================================================
  // 5. PERFORMANCE RUNS
  // ========================================================================

  await seedPerformanceRuns(PROJECT_IDS.banking);
  console.log('  Created performance runs.');

  // ========================================================================
  // 6. MIGRATIONS
  // ========================================================================

  await seedMigrations(PROJECT_IDS.banking);
  console.log('  Created migrations.');

  // ========================================================================
  // 7. DATA LIFECYCLE RULES
  // ========================================================================

  await seedDataLifecycleRules(PROJECT_IDS.banking);
  console.log('  Created data lifecycle rules.');

  // ========================================================================
  // 8. DATABASE CONNECTIONS
  // ========================================================================

  await seedConnections(PROJECT_IDS.banking, PROJECT_IDS.ecommerce);
  console.log('  Created database connections.');

  // ========================================================================
  // 9. AI CONVERSATIONS
  // ========================================================================

  await seedAIConversations(PROJECT_IDS.banking);
  console.log('  Created AI conversations.');

  // ========================================================================
  // 10. AUDIT LOGS
  // ========================================================================

  await seedAuditLogs(PROJECT_IDS.banking, PROJECT_IDS.ecommerce);
  console.log('  Created audit logs.');

  console.log('\nSeed complete!');
}

// ──────────────────────────────────────────────────────────────────────────────
// Banking Core Schema — 8 tables
// ──────────────────────────────────────────────────────────────────────────────

async function createBankingSchema(projectId: string) {
  const tableData = [
    {
      tableName: 'customers',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'first_name', type: 'varchar(100)', nullable: false },
        { name: 'last_name', type: 'varchar(100)', nullable: false },
        { name: 'email', type: 'varchar(255)', nullable: false, unique: true },
        { name: 'phone', type: 'varchar(20)', nullable: true },
        { name: 'date_of_birth', type: 'date', nullable: true },
        { name: 'ssn_encrypted', type: 'varchar(512)', nullable: true },
        { name: 'kyc_status', type: 'varchar(20)', nullable: false },
        { name: 'risk_score', type: 'integer', nullable: true },
        { name: 'created_at', type: 'timestamp', nullable: false },
        { name: 'updated_at', type: 'timestamp', nullable: false },
      ],
      indexes: [
        { name: 'idx_customers_email', type: 'btree', unique: true, columns: ['email'] },
        { name: 'idx_customers_kyc', type: 'btree', unique: false, columns: ['kyc_status'] },
        { name: 'idx_customers_name', type: 'btree', unique: false, columns: ['last_name', 'first_name'] },
      ],
      constraints: [
        { name: 'pk_customers', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'uq_customers_email', type: 'UNIQUE', columns: ['email'] },
        { name: 'chk_customers_kyc', type: 'CHECK', columns: ['kyc_status'] },
      ],
      estimatedRows: 1250000,
    },
    {
      tableName: 'accounts',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'customer_id', type: 'uuid', nullable: false },
        { name: 'account_number', type: 'varchar(20)', nullable: false, unique: true },
        { name: 'account_type', type: 'varchar(30)', nullable: false },
        { name: 'currency', type: 'char(3)', nullable: false },
        { name: 'balance', type: 'decimal(18,2)', nullable: false },
        { name: 'available_balance', type: 'decimal(18,2)', nullable: false },
        { name: 'status', type: 'varchar(20)', nullable: false },
        { name: 'opened_at', type: 'timestamp', nullable: false },
        { name: 'closed_at', type: 'timestamp', nullable: true },
        { name: 'branch_code', type: 'varchar(10)', nullable: true },
      ],
      indexes: [
        { name: 'idx_accounts_customer', type: 'btree', unique: false, columns: ['customer_id'] },
        { name: 'idx_accounts_number', type: 'btree', unique: true, columns: ['account_number'] },
        { name: 'idx_accounts_status', type: 'btree', unique: false, columns: ['status'] },
      ],
      constraints: [
        { name: 'pk_accounts', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'uq_accounts_number', type: 'UNIQUE', columns: ['account_number'] },
        { name: 'fk_accounts_customer', type: 'FOREIGN KEY', columns: ['customer_id'] },
      ],
      estimatedRows: 2800000,
    },
    {
      tableName: 'transactions',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'account_id', type: 'uuid', nullable: false },
        { name: 'transaction_type', type: 'varchar(30)', nullable: false },
        { name: 'amount', type: 'decimal(18,2)', nullable: false },
        { name: 'currency', type: 'char(3)', nullable: false },
        { name: 'description', type: 'varchar(500)', nullable: true },
        { name: 'reference_number', type: 'varchar(50)', nullable: false },
        { name: 'counterparty_account', type: 'varchar(20)', nullable: true },
        { name: 'status', type: 'varchar(20)', nullable: false },
        { name: 'channel', type: 'varchar(20)', nullable: true },
        { name: 'created_at', type: 'timestamp', nullable: false },
        { name: 'settled_at', type: 'timestamp', nullable: true },
      ],
      indexes: [
        { name: 'idx_txn_account', type: 'btree', unique: false, columns: ['account_id'] },
        { name: 'idx_txn_reference', type: 'btree', unique: true, columns: ['reference_number'] },
        { name: 'idx_txn_created', type: 'btree', unique: false, columns: ['created_at'] },
        { name: 'idx_txn_status', type: 'btree', unique: false, columns: ['status'] },
      ],
      constraints: [
        { name: 'pk_transactions', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'fk_txn_account', type: 'FOREIGN KEY', columns: ['account_id'] },
      ],
      estimatedRows: 45000000,
    },
    {
      tableName: 'cards',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'account_id', type: 'uuid', nullable: false },
        { name: 'card_number_masked', type: 'varchar(20)', nullable: false },
        { name: 'card_type', type: 'varchar(20)', nullable: false },
        { name: 'card_network', type: 'varchar(20)', nullable: false },
        { name: 'expiry_month', type: 'integer', nullable: false },
        { name: 'expiry_year', type: 'integer', nullable: false },
        { name: 'daily_limit', type: 'decimal(18,2)', nullable: false },
        { name: 'status', type: 'varchar(20)', nullable: false },
        { name: 'issued_at', type: 'timestamp', nullable: false },
        { name: 'blocked_at', type: 'timestamp', nullable: true },
      ],
      indexes: [
        { name: 'idx_cards_account', type: 'btree', unique: false, columns: ['account_id'] },
        { name: 'idx_cards_status', type: 'btree', unique: false, columns: ['status'] },
      ],
      constraints: [
        { name: 'pk_cards', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'fk_cards_account', type: 'FOREIGN KEY', columns: ['account_id'] },
      ],
      estimatedRows: 3200000,
    },
    {
      tableName: 'loans',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'customer_id', type: 'uuid', nullable: false },
        { name: 'account_id', type: 'uuid', nullable: false },
        { name: 'loan_type', type: 'varchar(30)', nullable: false },
        { name: 'principal_amount', type: 'decimal(18,2)', nullable: false },
        { name: 'interest_rate', type: 'decimal(5,4)', nullable: false },
        { name: 'term_months', type: 'integer', nullable: false },
        { name: 'outstanding_balance', type: 'decimal(18,2)', nullable: false },
        { name: 'status', type: 'varchar(20)', nullable: false },
        { name: 'disbursed_at', type: 'timestamp', nullable: true },
        { name: 'maturity_date', type: 'date', nullable: true },
        { name: 'next_payment_date', type: 'date', nullable: true },
      ],
      indexes: [
        { name: 'idx_loans_customer', type: 'btree', unique: false, columns: ['customer_id'] },
        { name: 'idx_loans_account', type: 'btree', unique: false, columns: ['account_id'] },
        { name: 'idx_loans_status', type: 'btree', unique: false, columns: ['status'] },
      ],
      constraints: [
        { name: 'pk_loans', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'fk_loans_customer', type: 'FOREIGN KEY', columns: ['customer_id'] },
        { name: 'fk_loans_account', type: 'FOREIGN KEY', columns: ['account_id'] },
      ],
      estimatedRows: 450000,
    },
    {
      tableName: 'loan_payments',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'loan_id', type: 'uuid', nullable: false },
        { name: 'payment_number', type: 'integer', nullable: false },
        { name: 'principal_amount', type: 'decimal(18,2)', nullable: false },
        { name: 'interest_amount', type: 'decimal(18,2)', nullable: false },
        { name: 'total_amount', type: 'decimal(18,2)', nullable: false },
        { name: 'due_date', type: 'date', nullable: false },
        { name: 'paid_date', type: 'date', nullable: true },
        { name: 'status', type: 'varchar(20)', nullable: false },
      ],
      indexes: [
        { name: 'idx_lp_loan', type: 'btree', unique: false, columns: ['loan_id'] },
        { name: 'idx_lp_due', type: 'btree', unique: false, columns: ['due_date'] },
      ],
      constraints: [
        { name: 'pk_loan_payments', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'fk_lp_loan', type: 'FOREIGN KEY', columns: ['loan_id'] },
      ],
      estimatedRows: 5400000,
    },
    {
      tableName: 'audit_trail',
      columns: [
        { name: 'id', type: 'bigserial', pk: true },
        { name: 'entity_type', type: 'varchar(50)', nullable: false },
        { name: 'entity_id', type: 'uuid', nullable: false },
        { name: 'action', type: 'varchar(30)', nullable: false },
        { name: 'changed_by', type: 'uuid', nullable: true },
        { name: 'old_values', type: 'jsonb', nullable: true },
        { name: 'new_values', type: 'jsonb', nullable: true },
        { name: 'ip_address', type: 'inet', nullable: true },
        { name: 'created_at', type: 'timestamp', nullable: false },
      ],
      indexes: [
        { name: 'idx_audit_entity', type: 'btree', unique: false, columns: ['entity_type', 'entity_id'] },
        { name: 'idx_audit_created', type: 'btree', unique: false, columns: ['created_at'] },
      ],
      constraints: [
        { name: 'pk_audit_trail', type: 'PRIMARY KEY', columns: ['id'] },
      ],
      estimatedRows: 120000000,
    },
    {
      tableName: 'branches',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'branch_code', type: 'varchar(10)', nullable: false, unique: true },
        { name: 'name', type: 'varchar(200)', nullable: false },
        { name: 'address', type: 'text', nullable: true },
        { name: 'city', type: 'varchar(100)', nullable: true },
        { name: 'country', type: 'char(2)', nullable: false },
        { name: 'is_active', type: 'boolean', nullable: false },
        { name: 'manager_id', type: 'uuid', nullable: true },
      ],
      indexes: [
        { name: 'idx_branches_code', type: 'btree', unique: true, columns: ['branch_code'] },
        { name: 'idx_branches_country', type: 'btree', unique: false, columns: ['country'] },
      ],
      constraints: [
        { name: 'pk_branches', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'uq_branches_code', type: 'UNIQUE', columns: ['branch_code'] },
      ],
      estimatedRows: 850,
    },
  ];

  return createTablesWithRelationships(projectId, tableData, [
    // accounts → customers
    {
      sourceTable: 'accounts',
      targetTable: 'customers',
      sourceColumns: ['customer_id'],
      targetColumns: ['id'],
      constraintName: 'fk_accounts_customer',
      type: 'one-to-many',
    },
    // transactions → accounts
    {
      sourceTable: 'transactions',
      targetTable: 'accounts',
      sourceColumns: ['account_id'],
      targetColumns: ['id'],
      constraintName: 'fk_txn_account',
      type: 'one-to-many',
    },
    // cards → accounts
    {
      sourceTable: 'cards',
      targetTable: 'accounts',
      sourceColumns: ['account_id'],
      targetColumns: ['id'],
      constraintName: 'fk_cards_account',
      type: 'one-to-many',
    },
    // loans → customers
    {
      sourceTable: 'loans',
      targetTable: 'customers',
      sourceColumns: ['customer_id'],
      targetColumns: ['id'],
      constraintName: 'fk_loans_customer',
      type: 'one-to-many',
    },
    // loans → accounts
    {
      sourceTable: 'loans',
      targetTable: 'accounts',
      sourceColumns: ['account_id'],
      targetColumns: ['id'],
      constraintName: 'fk_loans_account',
      type: 'one-to-many',
    },
    // loan_payments → loans
    {
      sourceTable: 'loan_payments',
      targetTable: 'loans',
      sourceColumns: ['loan_id'],
      targetColumns: ['id'],
      constraintName: 'fk_lp_loan',
      type: 'one-to-many',
    },
  ]);
}

// ──────────────────────────────────────────────────────────────────────────────
// E-Commerce Schema — 6 tables
// ──────────────────────────────────────────────────────────────────────────────

async function createEcommerceSchema(projectId: string) {
  const tableData = [
    {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'bigint', pk: true },
        { name: 'username', type: 'varchar(50)', nullable: false, unique: true },
        { name: 'email', type: 'varchar(255)', nullable: false, unique: true },
        { name: 'password_hash', type: 'varchar(255)', nullable: false },
        { name: 'full_name', type: 'varchar(200)', nullable: true },
        { name: 'role', type: "enum('customer','admin','vendor')", nullable: false },
        { name: 'is_verified', type: 'tinyint(1)', nullable: false },
        { name: 'created_at', type: 'datetime', nullable: false },
        { name: 'last_login', type: 'datetime', nullable: true },
      ],
      indexes: [
        { name: 'idx_users_email', type: 'btree', unique: true, columns: ['email'] },
        { name: 'idx_users_username', type: 'btree', unique: true, columns: ['username'] },
      ],
      constraints: [
        { name: 'pk_users', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'uq_users_email', type: 'UNIQUE', columns: ['email'] },
      ],
      estimatedRows: 580000,
    },
    {
      tableName: 'products',
      columns: [
        { name: 'id', type: 'bigint', pk: true },
        { name: 'sku', type: 'varchar(50)', nullable: false, unique: true },
        { name: 'name', type: 'varchar(300)', nullable: false },
        { name: 'description', type: 'text', nullable: true },
        { name: 'category_id', type: 'bigint', nullable: true },
        { name: 'price', type: 'decimal(10,2)', nullable: false },
        { name: 'cost_price', type: 'decimal(10,2)', nullable: true },
        { name: 'stock_quantity', type: 'int', nullable: false },
        { name: 'status', type: "enum('active','draft','archived')", nullable: false },
        { name: 'weight_kg', type: 'decimal(6,3)', nullable: true },
        { name: 'created_at', type: 'datetime', nullable: false },
        { name: 'updated_at', type: 'datetime', nullable: false },
      ],
      indexes: [
        { name: 'idx_products_sku', type: 'btree', unique: true, columns: ['sku'] },
        { name: 'idx_products_category', type: 'btree', unique: false, columns: ['category_id'] },
        { name: 'idx_products_status', type: 'btree', unique: false, columns: ['status'] },
      ],
      constraints: [
        { name: 'pk_products', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'uq_products_sku', type: 'UNIQUE', columns: ['sku'] },
      ],
      estimatedRows: 125000,
    },
    {
      tableName: 'categories',
      columns: [
        { name: 'id', type: 'bigint', pk: true },
        { name: 'name', type: 'varchar(100)', nullable: false },
        { name: 'slug', type: 'varchar(120)', nullable: false, unique: true },
        { name: 'parent_id', type: 'bigint', nullable: true },
        { name: 'sort_order', type: 'int', nullable: false },
        { name: 'is_active', type: 'tinyint(1)', nullable: false },
      ],
      indexes: [
        { name: 'idx_cat_slug', type: 'btree', unique: true, columns: ['slug'] },
        { name: 'idx_cat_parent', type: 'btree', unique: false, columns: ['parent_id'] },
      ],
      constraints: [
        { name: 'pk_categories', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'uq_cat_slug', type: 'UNIQUE', columns: ['slug'] },
      ],
      estimatedRows: 350,
    },
    {
      tableName: 'orders',
      columns: [
        { name: 'id', type: 'bigint', pk: true },
        { name: 'user_id', type: 'bigint', nullable: false },
        { name: 'order_number', type: 'varchar(30)', nullable: false, unique: true },
        { name: 'status', type: "enum('pending','processing','shipped','delivered','cancelled')", nullable: false },
        { name: 'subtotal', type: 'decimal(12,2)', nullable: false },
        { name: 'tax_amount', type: 'decimal(10,2)', nullable: false },
        { name: 'shipping_cost', type: 'decimal(8,2)', nullable: false },
        { name: 'total_amount', type: 'decimal(12,2)', nullable: false },
        { name: 'shipping_address', type: 'json', nullable: true },
        { name: 'notes', type: 'text', nullable: true },
        { name: 'ordered_at', type: 'datetime', nullable: false },
        { name: 'shipped_at', type: 'datetime', nullable: true },
        { name: 'delivered_at', type: 'datetime', nullable: true },
      ],
      indexes: [
        { name: 'idx_orders_user', type: 'btree', unique: false, columns: ['user_id'] },
        { name: 'idx_orders_number', type: 'btree', unique: true, columns: ['order_number'] },
        { name: 'idx_orders_status', type: 'btree', unique: false, columns: ['status'] },
        { name: 'idx_orders_date', type: 'btree', unique: false, columns: ['ordered_at'] },
      ],
      constraints: [
        { name: 'pk_orders', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'fk_orders_user', type: 'FOREIGN KEY', columns: ['user_id'] },
      ],
      estimatedRows: 3200000,
    },
    {
      tableName: 'order_items',
      columns: [
        { name: 'id', type: 'bigint', pk: true },
        { name: 'order_id', type: 'bigint', nullable: false },
        { name: 'product_id', type: 'bigint', nullable: false },
        { name: 'quantity', type: 'int', nullable: false },
        { name: 'unit_price', type: 'decimal(10,2)', nullable: false },
        { name: 'total_price', type: 'decimal(12,2)', nullable: false },
        { name: 'discount_pct', type: 'decimal(5,2)', nullable: true },
      ],
      indexes: [
        { name: 'idx_oi_order', type: 'btree', unique: false, columns: ['order_id'] },
        { name: 'idx_oi_product', type: 'btree', unique: false, columns: ['product_id'] },
      ],
      constraints: [
        { name: 'pk_order_items', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'fk_oi_order', type: 'FOREIGN KEY', columns: ['order_id'] },
        { name: 'fk_oi_product', type: 'FOREIGN KEY', columns: ['product_id'] },
      ],
      estimatedRows: 8900000,
    },
    {
      tableName: 'reviews',
      columns: [
        { name: 'id', type: 'bigint', pk: true },
        { name: 'user_id', type: 'bigint', nullable: false },
        { name: 'product_id', type: 'bigint', nullable: false },
        { name: 'rating', type: 'tinyint', nullable: false },
        { name: 'title', type: 'varchar(200)', nullable: true },
        { name: 'body', type: 'text', nullable: true },
        { name: 'is_verified', type: 'tinyint(1)', nullable: false },
        { name: 'created_at', type: 'datetime', nullable: false },
      ],
      indexes: [
        { name: 'idx_reviews_product', type: 'btree', unique: false, columns: ['product_id'] },
        { name: 'idx_reviews_user', type: 'btree', unique: false, columns: ['user_id'] },
      ],
      constraints: [
        { name: 'pk_reviews', type: 'PRIMARY KEY', columns: ['id'] },
        { name: 'fk_reviews_user', type: 'FOREIGN KEY', columns: ['user_id'] },
        { name: 'fk_reviews_product', type: 'FOREIGN KEY', columns: ['product_id'] },
      ],
      estimatedRows: 1650000,
    },
  ];

  return createTablesWithRelationships(projectId, tableData, [
    { sourceTable: 'products', targetTable: 'categories', sourceColumns: ['category_id'], targetColumns: ['id'], constraintName: 'fk_products_category', type: 'one-to-many' },
    { sourceTable: 'orders', targetTable: 'users', sourceColumns: ['user_id'], targetColumns: ['id'], constraintName: 'fk_orders_user', type: 'one-to-many' },
    { sourceTable: 'order_items', targetTable: 'orders', sourceColumns: ['order_id'], targetColumns: ['id'], constraintName: 'fk_oi_order', type: 'one-to-many' },
    { sourceTable: 'order_items', targetTable: 'products', sourceColumns: ['product_id'], targetColumns: ['id'], constraintName: 'fk_oi_product', type: 'one-to-many' },
    { sourceTable: 'reviews', targetTable: 'users', sourceColumns: ['user_id'], targetColumns: ['id'], constraintName: 'fk_reviews_user', type: 'one-to-many' },
    { sourceTable: 'reviews', targetTable: 'products', sourceColumns: ['product_id'], targetColumns: ['id'], constraintName: 'fk_reviews_product', type: 'one-to-many' },
    // Self-referential: categories → categories (parent)
    { sourceTable: 'categories', targetTable: 'categories', sourceColumns: ['parent_id'], targetColumns: ['id'], constraintName: 'fk_cat_parent', type: 'one-to-many', isInferred: true },
  ]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Generic table + relationship creator
// ──────────────────────────────────────────────────────────────────────────────

interface TableDef {
  tableName: string;
  columns: { name: string; type: string; pk?: boolean; nullable?: boolean; unique?: boolean }[];
  indexes: { name: string; type: string; unique: boolean; columns: string[] }[];
  constraints: { name: string; type: string; columns: string[] }[];
  estimatedRows?: number;
}

interface RelDef {
  sourceTable: string;
  targetTable: string;
  sourceColumns: string[];
  targetColumns: string[];
  constraintName: string;
  type: string;
  isInferred?: boolean;
}

async function createTablesWithRelationships(
  projectId: string,
  tableData: TableDef[],
  relationships: RelDef[],
) {
  const tableIdMap = new Map<string, string>();

  // Create tables with columns, indexes, constraints
  for (const td of tableData) {
    const table = await prisma.tableMetadata.create({
      data: {
        projectId,
        schemaName: 'public',
        tableName: td.tableName,
        tableType: 'table',
        estimatedRows: td.estimatedRows ?? null,
      },
    });

    tableIdMap.set(td.tableName, table.id);

    // Columns
    for (let i = 0; i < td.columns.length; i++) {
      const col = td.columns[i];
      await prisma.columnMetadata.create({
        data: {
          tableId: table.id,
          columnName: col.name,
          dataType: col.type,
          normalizedType: normalizeType(col.type),
          ordinalPosition: i + 1,
          isNullable: col.nullable ?? true,
          isPrimaryKey: col.pk ?? false,
          isUnique: col.unique ?? false,
        },
      });
    }

    // Indexes
    for (const idx of td.indexes) {
      await prisma.indexMetadata.create({
        data: {
          tableId: table.id,
          indexName: idx.name,
          indexType: idx.type,
          isUnique: idx.unique,
          isPrimary: idx.name.startsWith('pk_'),
          columns: JSON.stringify(idx.columns),
        },
      });
    }

    // Constraints
    for (const con of td.constraints) {
      await prisma.constraintMetadata.create({
        data: {
          tableId: table.id,
          constraintName: con.name,
          constraintType: con.type,
          columns: JSON.stringify(con.columns),
        },
      });
    }
  }

  // Create relationships
  for (const rel of relationships) {
    const sourceId = tableIdMap.get(rel.sourceTable);
    const targetId = tableIdMap.get(rel.targetTable);
    if (!sourceId || !targetId) continue;

    await prisma.relationshipMetadata.create({
      data: {
        sourceTableId: sourceId,
        targetTableId: targetId,
        relationshipType: rel.type,
        sourceColumns: JSON.stringify(rel.sourceColumns),
        targetColumns: JSON.stringify(rel.targetColumns),
        constraintName: rel.constraintName,
        isInferred: rel.isInferred ?? false,
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      },
    });
  }

  return tableData;
}

// ──────────────────────────────────────────────────────────────────────────────
// Saved Queries + Executions
// ──────────────────────────────────────────────────────────────────────────────

async function seedQueries(projectId: string) {
  const isBanking = projectId === PROJECT_IDS.banking;
  const dialect = isBanking ? 'postgresql' : 'mysql';

  const queries = isBanking
    ? [
        {
          title: 'High-Value Customer Transactions',
          sql: `SELECT c.first_name, c.last_name, a.account_number,\n       COUNT(t.id) AS txn_count,\n       SUM(t.amount) AS total_amount\nFROM customers c\nJOIN accounts a ON a.customer_id = c.id\nJOIN transactions t ON t.account_id = a.id\nWHERE t.created_at >= NOW() - INTERVAL '30 days'\n  AND t.amount > 10000\nGROUP BY c.id, c.first_name, c.last_name, a.account_number\nORDER BY total_amount DESC\nLIMIT 50;`,
          category: 'analytics',
          isFavorite: true,
        },
        {
          title: 'Overdue Loan Payments',
          sql: `SELECT l.id AS loan_id, c.email,\n       lp.due_date, lp.total_amount,\n       CURRENT_DATE - lp.due_date AS days_overdue\nFROM loan_payments lp\nJOIN loans l ON l.id = lp.loan_id\nJOIN customers c ON c.id = l.customer_id\nWHERE lp.status = 'pending'\n  AND lp.due_date < CURRENT_DATE\nORDER BY days_overdue DESC;`,
          category: 'operations',
          isFavorite: false,
        },
        {
          title: 'Daily Transaction Summary',
          sql: `SELECT DATE(t.created_at) AS txn_date,\n       t.transaction_type,\n       COUNT(*) AS txn_count,\n       SUM(t.amount) AS total_amount,\n       AVG(t.amount) AS avg_amount\nFROM transactions t\nWHERE t.created_at >= NOW() - INTERVAL '7 days'\nGROUP BY DATE(t.created_at), t.transaction_type\nORDER BY txn_date DESC, total_amount DESC;`,
          category: 'reporting',
          isFavorite: true,
        },
        {
          title: 'Active Cards by Network',
          sql: `SELECT card_network,\n       COUNT(*) AS total_cards,\n       COUNT(*) FILTER (WHERE status = 'active') AS active_cards,\n       ROUND(AVG(daily_limit), 2) AS avg_daily_limit\nFROM cards\nGROUP BY card_network\nORDER BY total_cards DESC;`,
          category: 'analytics',
          isFavorite: false,
        },
        {
          title: 'Customer Account Balances',
          sql: `SELECT c.id, c.first_name || ' ' || c.last_name AS full_name,\n       COUNT(a.id) AS account_count,\n       SUM(a.balance) AS total_balance,\n       MAX(a.balance) AS max_balance\nFROM customers c\nJOIN accounts a ON a.customer_id = c.id\nWHERE a.status = 'active'\nGROUP BY c.id, c.first_name, c.last_name\nHAVING SUM(a.balance) > 100000\nORDER BY total_balance DESC\nLIMIT 100;`,
          category: 'analytics',
          isFavorite: true,
        },
      ]
    : [
        {
          title: 'Top Selling Products',
          sql: `SELECT p.name, p.sku, p.price,\n       SUM(oi.quantity) AS units_sold,\n       SUM(oi.total_price) AS revenue\nFROM products p\nJOIN order_items oi ON oi.product_id = p.id\nJOIN orders o ON o.id = oi.order_id\nWHERE o.status IN ('shipped', 'delivered')\n  AND o.ordered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)\nGROUP BY p.id, p.name, p.sku, p.price\nORDER BY revenue DESC\nLIMIT 20;`,
          category: 'analytics',
          isFavorite: true,
        },
        {
          title: 'Order Fulfillment Report',
          sql: `SELECT DATE(ordered_at) AS order_date,\n       status,\n       COUNT(*) AS order_count,\n       SUM(total_amount) AS total_revenue\nFROM orders\nWHERE ordered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)\nGROUP BY DATE(ordered_at), status\nORDER BY order_date DESC;`,
          category: 'reporting',
          isFavorite: false,
        },
        {
          title: 'Low Stock Alert',
          sql: `SELECT p.sku, p.name, p.stock_quantity, p.price,\n       c.name AS category\nFROM products p\nLEFT JOIN categories c ON c.id = p.category_id\nWHERE p.status = 'active'\n  AND p.stock_quantity < 10\nORDER BY p.stock_quantity ASC;`,
          category: 'operations',
          isFavorite: true,
        },
      ];

  for (const q of queries) {
    const saved = await prisma.savedQuery.create({
      data: {
        projectId,
        title: q.title,
        sql: q.sql,
        dialect,
        category: q.category,
        isFavorite: q.isFavorite,
      },
    });

    // Create some execution history for each query
    const executionCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < executionCount; i++) {
      const isSuccess = Math.random() > 0.15;
      const execTime = 50 + Math.floor(Math.random() * 2000);
      const rowsReturned = isSuccess ? Math.floor(Math.random() * 500) + 1 : null;

      await prisma.queryExecution.create({
        data: {
          projectId,
          savedQueryId: saved.id,
          sql: q.sql,
          dialect,
          status: isSuccess ? 'completed' : 'error',
          executionTime: execTime,
          rowsReturned,
          errorMessage: isSuccess ? null : 'ERROR: relation "temp_table" does not exist',
          executedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 86400000)),
        },
      });
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Performance Runs
// ──────────────────────────────────────────────────────────────────────────────

async function seedPerformanceRuns(projectId: string) {
  const runs = [
    {
      runType: 'benchmark',
      status: 'completed',
      summary: 'Full query benchmark completed. 12 queries tested across 3 table sizes.',
      findings: JSON.stringify([
        { query: 'High-Value Transactions', avgTime: 234, p95Time: 456, rowsScanned: 45000000 },
        { query: 'Customer Balances', avgTime: 89, p95Time: 145, rowsScanned: 1250000 },
        { query: 'Daily Summary', avgTime: 512, p95Time: 1024, rowsScanned: 45000000 },
      ]),
      recommendations: JSON.stringify([
        'Add composite index on transactions(account_id, created_at) for time-range queries',
        'Consider partitioning transactions table by created_at (monthly)',
        'The accounts.status column has low cardinality — bitmap index may be more efficient',
      ]),
      completedAt: new Date(Date.now() - 86400000),
    },
    {
      runType: 'index-analysis',
      status: 'completed',
      summary: 'Index analysis found 3 missing indexes and 2 unused indexes.',
      findings: JSON.stringify({
        missingIndexes: [
          { table: 'transactions', columns: ['account_id', 'created_at'], impact: 'high' },
          { table: 'loans', columns: ['customer_id', 'status'], impact: 'medium' },
          { table: 'cards', columns: ['account_id', 'status'], impact: 'medium' },
        ],
        unusedIndexes: [
          { table: 'customers', index: 'idx_customers_kyc', lastUsed: null },
          { table: 'accounts', index: 'idx_accounts_status', lastUsed: '2025-12-01' },
        ],
      }),
      recommendations: JSON.stringify([
        'CREATE INDEX idx_txn_account_created ON transactions(account_id, created_at);',
        'CREATE INDEX idx_loans_cust_status ON loans(customer_id, status);',
        'Consider dropping idx_customers_kyc (unused for 90+ days)',
      ]),
      completedAt: new Date(Date.now() - 3 * 86400000),
    },
    {
      runType: 'benchmark',
      status: 'completed',
      summary: 'Synthetic data benchmark with 10M rows. Performance within acceptable thresholds.',
      findings: JSON.stringify([
        { query: 'Transaction Lookup', avgTime: 12, p95Time: 28, rowsScanned: 1 },
        { query: 'Account Summary', avgTime: 145, p95Time: 298, rowsScanned: 2800000 },
      ]),
      recommendations: JSON.stringify([
        'Query performance is within SLA thresholds',
        'Monitor p95 latency on Account Summary during peak hours',
      ]),
      completedAt: new Date(Date.now() - 7 * 86400000),
    },
    {
      runType: 'index-analysis',
      status: 'running',
      summary: 'Analyzing index usage patterns for the last 30 days...',
      findings: null,
      recommendations: null,
      completedAt: null,
    },
  ];

  for (const run of runs) {
    await prisma.performanceRun.create({
      data: {
        projectId,
        runType: run.runType,
        status: run.status,
        summary: run.summary,
        findings: run.findings,
        recommendations: run.recommendations,
        startedAt: new Date(
          (run.completedAt ?? new Date()).getTime() - 120000,
        ),
        completedAt: run.completedAt,
      },
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Migrations
// ──────────────────────────────────────────────────────────────────────────────

async function seedMigrations(projectId: string) {
  const migrations = [
    {
      version: '001',
      title: 'Initial schema — customers and accounts',
      status: 'completed',
      upSQL: `CREATE TABLE customers (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  first_name VARCHAR(100) NOT NULL,\n  last_name VARCHAR(100) NOT NULL,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  created_at TIMESTAMP DEFAULT NOW()\n);\n\nCREATE TABLE accounts (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  customer_id UUID REFERENCES customers(id),\n  account_number VARCHAR(20) UNIQUE NOT NULL,\n  balance DECIMAL(18,2) DEFAULT 0,\n  status VARCHAR(20) DEFAULT 'active'\n);`,
      downSQL: 'DROP TABLE IF EXISTS accounts;\nDROP TABLE IF EXISTS customers;',
      appliedAt: new Date(Date.now() - 30 * 86400000),
    },
    {
      version: '002',
      title: 'Add transactions table',
      status: 'completed',
      upSQL: `CREATE TABLE transactions (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  account_id UUID REFERENCES accounts(id),\n  transaction_type VARCHAR(30) NOT NULL,\n  amount DECIMAL(18,2) NOT NULL,\n  reference_number VARCHAR(50) UNIQUE NOT NULL,\n  status VARCHAR(20) DEFAULT 'pending',\n  created_at TIMESTAMP DEFAULT NOW()\n);\n\nCREATE INDEX idx_txn_account ON transactions(account_id);\nCREATE INDEX idx_txn_created ON transactions(created_at);`,
      downSQL: 'DROP TABLE IF EXISTS transactions;',
      appliedAt: new Date(Date.now() - 25 * 86400000),
    },
    {
      version: '003',
      title: 'Add cards and loans tables',
      status: 'completed',
      upSQL: `CREATE TABLE cards (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  account_id UUID REFERENCES accounts(id),\n  card_type VARCHAR(20) NOT NULL,\n  status VARCHAR(20) DEFAULT 'active',\n  issued_at TIMESTAMP DEFAULT NOW()\n);\n\nCREATE TABLE loans (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  customer_id UUID REFERENCES customers(id),\n  principal_amount DECIMAL(18,2) NOT NULL,\n  interest_rate DECIMAL(5,4) NOT NULL,\n  status VARCHAR(20) DEFAULT 'pending'\n);`,
      downSQL: 'DROP TABLE IF EXISTS loans;\nDROP TABLE IF EXISTS cards;',
      appliedAt: new Date(Date.now() - 20 * 86400000),
    },
    {
      version: '004',
      title: 'Add KYC fields and risk scoring',
      status: 'completed',
      upSQL: `ALTER TABLE customers ADD COLUMN kyc_status VARCHAR(20) DEFAULT 'pending';\nALTER TABLE customers ADD COLUMN risk_score INTEGER;\nALTER TABLE customers ADD COLUMN ssn_encrypted VARCHAR(512);\n\nCREATE INDEX idx_customers_kyc ON customers(kyc_status);`,
      downSQL: `ALTER TABLE customers DROP COLUMN kyc_status;\nALTER TABLE customers DROP COLUMN risk_score;\nALTER TABLE customers DROP COLUMN ssn_encrypted;\n\nDROP INDEX IF EXISTS idx_customers_kyc;`,
      appliedAt: new Date(Date.now() - 10 * 86400000),
    },
    {
      version: '005',
      title: 'Add audit trail table',
      status: 'completed',
      upSQL: `CREATE TABLE audit_trail (\n  id BIGSERIAL PRIMARY KEY,\n  entity_type VARCHAR(50) NOT NULL,\n  entity_id UUID NOT NULL,\n  action VARCHAR(30) NOT NULL,\n  old_values JSONB,\n  new_values JSONB,\n  created_at TIMESTAMP DEFAULT NOW()\n);\n\nCREATE INDEX idx_audit_entity ON audit_trail(entity_type, entity_id);\nCREATE INDEX idx_audit_created ON audit_trail(created_at);`,
      downSQL: 'DROP TABLE IF EXISTS audit_trail;',
      appliedAt: new Date(Date.now() - 5 * 86400000),
    },
    {
      version: '006',
      title: 'Add loan payments table and indexes',
      status: 'pending',
      upSQL: `CREATE TABLE loan_payments (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  loan_id UUID REFERENCES loans(id),\n  payment_number INTEGER NOT NULL,\n  principal_amount DECIMAL(18,2) NOT NULL,\n  interest_amount DECIMAL(18,2) NOT NULL,\n  total_amount DECIMAL(18,2) NOT NULL,\n  due_date DATE NOT NULL,\n  status VARCHAR(20) DEFAULT 'pending'\n);\n\nCREATE INDEX idx_lp_loan ON loan_payments(loan_id);\nCREATE INDEX idx_lp_due ON loan_payments(due_date);`,
      downSQL: 'DROP TABLE IF EXISTS loan_payments;',
      appliedAt: null,
    },
    {
      version: '007',
      title: 'Partition transactions by date',
      status: 'draft',
      upSQL: `-- Convert transactions to partitioned table\nALTER TABLE transactions RENAME TO transactions_old;\n\nCREATE TABLE transactions (\n  LIKE transactions_old INCLUDING ALL\n) PARTITION BY RANGE (created_at);\n\nCREATE TABLE transactions_2025_q1 PARTITION OF transactions\n  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');\nCREATE TABLE transactions_2025_q2 PARTITION OF transactions\n  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');`,
      downSQL: `DROP TABLE IF EXISTS transactions;\nALTER TABLE transactions_old RENAME TO transactions;`,
      appliedAt: null,
    },
  ];

  for (const m of migrations) {
    await prisma.migration.create({
      data: {
        projectId,
        version: m.version,
        title: m.title,
        status: m.status,
        upSQL: m.upSQL,
        downSQL: m.downSQL,
        sourceDialect: 'postgresql',
        targetDialect: 'postgresql',
        checksum: crypto.createHash('md5').update(m.upSQL).digest('hex'),
        appliedAt: m.appliedAt,
      },
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Data Lifecycle Rules
// ──────────────────────────────────────────────────────────────────────────────

async function seedDataLifecycleRules(projectId: string) {
  const rules = [
    {
      ruleName: 'Transaction Retention — 7 Years',
      ruleType: 'retention',
      targetTable: 'transactions',
      targetColumns: null,
      isActive: true,
      configuration: JSON.stringify({
        retentionPeriod: '7 years',
        action: 'archive_then_delete',
        archiveDestination: 's3://banking-archive/transactions/',
        batchSize: 50000,
        schedule: '0 2 1 * *',
        condition: "status IN ('completed', 'reversed')",
        compliance: ['PCI-DSS', 'SOX'],
      }),
    },
    {
      ruleName: 'Audit Trail Purge — 10 Years',
      ruleType: 'retention',
      targetTable: 'audit_trail',
      targetColumns: null,
      isActive: true,
      configuration: JSON.stringify({
        retentionPeriod: '10 years',
        action: 'archive_then_delete',
        archiveDestination: 's3://banking-archive/audit/',
        batchSize: 100000,
        schedule: '0 3 1 * *',
        compliance: ['SOX', 'GDPR'],
      }),
    },
    {
      ruleName: 'PII Data Classification',
      ruleType: 'classification',
      targetTable: 'customers',
      targetColumns: JSON.stringify(['email', 'phone', 'ssn_encrypted', 'date_of_birth']),
      isActive: true,
      configuration: JSON.stringify({
        sensitivityLevel: 'high',
        piiTypes: ['EMAIL', 'PHONE', 'SSN', 'DOB'],
        encryptionRequired: true,
        accessRestriction: 'role_based',
        maskingRule: 'partial',
        compliance: ['GDPR', 'CCPA', 'PCI-DSS'],
      }),
    },
    {
      ruleName: 'Closed Account Cleanup',
      ruleType: 'purge',
      targetTable: 'accounts',
      targetColumns: null,
      isActive: false,
      configuration: JSON.stringify({
        retentionPeriod: '5 years',
        action: 'soft_delete',
        condition: "status = 'closed' AND closed_at < NOW() - INTERVAL '5 years'",
        batchSize: 10000,
        schedule: '0 4 15 * *',
        requiresApproval: true,
        approver: 'compliance-team',
      }),
    },
    {
      ruleName: 'Card Data Masking',
      ruleType: 'classification',
      targetTable: 'cards',
      targetColumns: JSON.stringify(['card_number_masked']),
      isActive: true,
      configuration: JSON.stringify({
        sensitivityLevel: 'critical',
        piiTypes: ['PAN'],
        maskingRule: 'first6_last4',
        compliance: ['PCI-DSS'],
        encryptionRequired: true,
      }),
    },
    {
      ruleName: 'Expired Loan Archival',
      ruleType: 'retention',
      targetTable: 'loans',
      targetColumns: null,
      isActive: true,
      configuration: JSON.stringify({
        retentionPeriod: '7 years',
        action: 'archive',
        condition: "status = 'paid_off' AND maturity_date < CURRENT_DATE - INTERVAL '7 years'",
        archiveDestination: 's3://banking-archive/loans/',
        schedule: '0 2 1 1 *',
        compliance: ['SOX'],
      }),
    },
  ];

  for (const r of rules) {
    await prisma.dataLifecycleRule.create({
      data: {
        projectId,
        ruleName: r.ruleName,
        ruleType: r.ruleType,
        targetTable: r.targetTable,
        targetColumns: r.targetColumns,
        isActive: r.isActive,
        configuration: r.configuration,
      },
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Database Connections
// ──────────────────────────────────────────────────────────────────────────────

async function seedConnections(bankingId: string, ecommerceId: string) {
  const connections = [
    {
      projectId: bankingId,
      name: 'Banking Production (Read Replica)',
      dialect: 'postgresql',
      host: 'banking-read.cluster-abc123.us-east-1.rds.amazonaws.com',
      port: 5432,
      database: 'banking_core',
      username: 'readonly_user',
      password: 'demo-readonly-password',
      sslEnabled: true,
      isActive: true,
    },
    {
      projectId: bankingId,
      name: 'Banking Staging',
      dialect: 'postgresql',
      host: 'banking-staging.internal.company.com',
      port: 5432,
      database: 'banking_staging',
      username: 'dev_user',
      password: 'staging-dev-password',
      sslEnabled: false,
      isActive: true,
    },
    {
      projectId: ecommerceId,
      name: 'E-Commerce Production',
      dialect: 'mysql',
      host: 'ecom-primary.cluster-xyz789.us-west-2.rds.amazonaws.com',
      port: 3306,
      database: 'ecommerce_prod',
      username: 'app_readonly',
      password: 'ecom-readonly-password',
      sslEnabled: true,
      isActive: true,
    },
    {
      projectId: ecommerceId,
      name: 'E-Commerce Dev',
      dialect: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'ecommerce_dev',
      username: 'root',
      password: 'local-dev-password',
      sslEnabled: false,
      isActive: false,
    },
  ];

  for (const conn of connections) {
    await prisma.databaseConnection.create({
      data: {
        projectId: conn.projectId,
        name: conn.name,
        dialect: conn.dialect,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        username: conn.username,
        passwordEncrypted: encrypt(conn.password),
        sslEnabled: conn.sslEnabled,
        isActive: conn.isActive,
      },
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// AI Conversations
// ──────────────────────────────────────────────────────────────────────────────

async function seedAIConversations(projectId: string) {
  const conversations = [
    {
      title: 'How to optimize slow transaction queries?',
      context: 'query',
      messages: [
        { role: 'user', content: 'My transaction lookup queries are taking over 2 seconds. The transactions table has 45 million rows. How can I optimize them?' },
        { role: 'assistant', content: 'For a 45M row transactions table, here are the key optimization strategies:\n\n**1. Composite Indexes**\nAdd a composite index on the most common query patterns:\n```sql\nCREATE INDEX idx_txn_account_created \n  ON transactions(account_id, created_at DESC);\n```\n\n**2. Table Partitioning**\nPartition by `created_at` (monthly or quarterly) to prune old data from queries:\n```sql\nCREATE TABLE transactions (\n  ...\n) PARTITION BY RANGE (created_at);\n```\n\n**3. Query Rewriting**\n- Always include a date range filter to leverage partition pruning\n- Use `LIMIT` for paginated results\n- Avoid `SELECT *` — only fetch needed columns\n\n**4. Connection Pooling**\nEnsure you\'re using PgBouncer or similar to reduce connection overhead.\n\nShall I generate the specific DDL for partitioning your transactions table?' },
        { role: 'user', content: 'Yes, please generate the partitioning DDL for quarterly partitions.' },
        { role: 'assistant', content: 'Here\'s the complete quarterly partitioning setup:\n\n```sql\n-- 1. Rename existing table\nALTER TABLE transactions RENAME TO transactions_old;\n\n-- 2. Create partitioned table\nCREATE TABLE transactions (\n  id UUID NOT NULL,\n  account_id UUID NOT NULL,\n  transaction_type VARCHAR(30) NOT NULL,\n  amount DECIMAL(18,2) NOT NULL,\n  reference_number VARCHAR(50) NOT NULL,\n  status VARCHAR(20) NOT NULL,\n  created_at TIMESTAMP NOT NULL,\n  PRIMARY KEY (id, created_at)\n) PARTITION BY RANGE (created_at);\n\n-- 3. Create quarterly partitions\nCREATE TABLE txn_2025_q1 PARTITION OF transactions\n  FOR VALUES FROM (\'2025-01-01\') TO (\'2025-04-01\');\nCREATE TABLE txn_2025_q2 PARTITION OF transactions\n  FOR VALUES FROM (\'2025-04-01\') TO (\'2025-07-01\');\nCREATE TABLE txn_2025_q3 PARTITION OF transactions\n  FOR VALUES FROM (\'2025-07-01\') TO (\'2025-10-01\');\nCREATE TABLE txn_2025_q4 PARTITION OF transactions\n  FOR VALUES FROM (\'2025-10-01\') TO (\'2026-01-01\');\n\n-- 4. Migrate data\nINSERT INTO transactions SELECT * FROM transactions_old;\n\n-- 5. Recreate indexes on partitioned table\nCREATE INDEX idx_txn_account ON transactions(account_id);\nCREATE INDEX idx_txn_created ON transactions(created_at);\nCREATE UNIQUE INDEX idx_txn_ref ON transactions(reference_number);\n```\n\nThis approach gives you transparent partition pruning — queries with `WHERE created_at >= \'2025-07-01\'` will only scan relevant partitions.' },
      ],
    },
    {
      title: 'Design a customer segmentation schema',
      context: 'schema',
      messages: [
        { role: 'user', content: 'I need to add customer segmentation to our banking schema. Customers should be categorized by risk level, product holdings, and transaction behavior.' },
        { role: 'assistant', content: 'Here\'s a recommended schema design for customer segmentation:\n\n```sql\n-- Segment definitions (managed by analytics team)\nCREATE TABLE customer_segments (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  segment_name VARCHAR(100) NOT NULL,\n  segment_type VARCHAR(30) NOT NULL, -- risk, product, behavior\n  criteria JSONB NOT NULL,\n  priority INTEGER DEFAULT 0,\n  is_active BOOLEAN DEFAULT true,\n  created_at TIMESTAMP DEFAULT NOW()\n);\n\n-- Customer-to-segment mapping (many-to-many)\nCREATE TABLE customer_segment_assignments (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  customer_id UUID REFERENCES customers(id),\n  segment_id UUID REFERENCES customer_segments(id),\n  score DECIMAL(5,2), -- confidence score\n  assigned_at TIMESTAMP DEFAULT NOW(),\n  expires_at TIMESTAMP,\n  UNIQUE(customer_id, segment_id)\n);\n\n-- Segment history for tracking changes\nCREATE TABLE segment_history (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  customer_id UUID REFERENCES customers(id),\n  old_segment_id UUID,\n  new_segment_id UUID,\n  reason VARCHAR(500),\n  changed_at TIMESTAMP DEFAULT NOW()\n);\n```\n\nKey design decisions:\n- **JSONB criteria**: Flexible rule definitions without schema changes\n- **Score field**: Supports ML-based segmentation with confidence scores\n- **Expiration**: Segments can auto-expire for re-evaluation\n- **History tracking**: Full audit trail of segment changes' },
      ],
    },
  ];

  for (const conv of conversations) {
    const created = await prisma.aIConversation.create({
      data: {
        projectId,
        title: conv.title,
        context: conv.context,
      },
    });

    for (const msg of conv.messages) {
      await prisma.aIMessage.create({
        data: {
          conversationId: created.id,
          role: msg.role,
          content: msg.content,
        },
      });
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Audit Logs
// ──────────────────────────────────────────────────────────────────────────────

async function seedAuditLogs(bankingId: string, ecommerceId: string) {
  const actions = [
    { projectId: bankingId, action: 'project.create', entity: 'Project', details: 'Created project "Banking Core System"' },
    { projectId: bankingId, action: 'file.upload', entity: 'ProjectFile', details: 'Uploaded banking_schema.sql (245 KB)' },
    { projectId: bankingId, action: 'schema.parse', entity: 'Schema', details: 'Parsed 8 tables, 78 columns, 6 relationships' },
    { projectId: bankingId, action: 'query.execute', entity: 'Query', details: 'Executed "High-Value Customer Transactions" (234ms, 50 rows)' },
    { projectId: bankingId, action: 'query.save', entity: 'SavedQuery', details: 'Saved query "High-Value Customer Transactions"' },
    { projectId: bankingId, action: 'snapshot.create', entity: 'SchemaSnapshot', details: 'Created schema snapshot v1' },
    { projectId: bankingId, action: 'performance.run', entity: 'PerformanceRun', details: 'Started query benchmark run' },
    { projectId: bankingId, action: 'migration.create', entity: 'Migration', details: 'Created migration v005 — Add audit trail table' },
    { projectId: bankingId, action: 'migration.apply', entity: 'Migration', details: 'Applied migration v005 successfully' },
    { projectId: bankingId, action: 'lifecycle.create', entity: 'DataLifecycleRule', details: 'Created retention rule "Transaction Retention — 7 Years"' },
    { projectId: bankingId, action: 'connection.create', entity: 'DatabaseConnection', details: 'Added connection "Banking Production (Read Replica)"' },
    { projectId: bankingId, action: 'connection.test', entity: 'DatabaseConnection', details: 'Tested connection "Banking Production" — Success' },
    { projectId: bankingId, action: 'ai.chat', entity: 'AIConversation', details: 'AI conversation: "How to optimize slow transaction queries?"' },
    { projectId: bankingId, action: 'schema.review', entity: 'Schema', details: 'AI schema review: Score 82/100, 3 warnings' },
    { projectId: ecommerceId, action: 'project.create', entity: 'Project', details: 'Created project "E-Commerce Platform"' },
    { projectId: ecommerceId, action: 'file.upload', entity: 'ProjectFile', details: 'Uploaded ecommerce_ddl.sql (128 KB)' },
    { projectId: ecommerceId, action: 'schema.parse', entity: 'Schema', details: 'Parsed 6 tables, 56 columns, 7 relationships' },
    { projectId: ecommerceId, action: 'query.execute', entity: 'Query', details: 'Executed "Top Selling Products" (89ms, 20 rows)' },
    { projectId: ecommerceId, action: 'connection.create', entity: 'DatabaseConnection', details: 'Added connection "E-Commerce Production"' },
    { projectId: null, action: 'settings.update', entity: 'AppSettings', details: 'Updated AI provider configuration (Anthropic)' },
  ];

  for (let i = 0; i < actions.length; i++) {
    await prisma.auditLog.create({
      data: {
        projectId: actions[i].projectId,
        action: actions[i].action,
        entity: actions[i].entity,
        details: actions[i].details,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Aqua-DB-Copilot/1.0',
        createdAt: new Date(Date.now() - (actions.length - i) * 3600000),
      },
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function normalizeType(dataType: string): string {
  const dt = dataType.toLowerCase();
  if (dt.includes('uuid')) return 'uuid';
  if (dt.includes('varchar') || dt.includes('char') || dt.includes('text')) return 'string';
  if (dt.includes('int') || dt.includes('serial')) return 'integer';
  if (dt.includes('decimal') || dt.includes('numeric') || dt.includes('float') || dt.includes('double')) return 'decimal';
  if (dt.includes('bool') || dt.includes('tinyint(1)')) return 'boolean';
  if (dt.includes('timestamp') || dt.includes('datetime')) return 'datetime';
  if (dt.includes('date')) return 'date';
  if (dt.includes('json')) return 'json';
  if (dt.includes('inet')) return 'string';
  if (dt.includes('enum')) return 'enum';
  return 'string';
}

// ── Run ─────────────────────────────────────────────────────────────────────

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

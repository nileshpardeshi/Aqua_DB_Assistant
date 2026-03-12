// ---------------------------------------------------------------------------
// Seed Script — Populates demo data for all pages of Aqua DB Copilot
// Run:  pnpm db:seed  (or tsx prisma/seed.ts)
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
  await prisma.dataSheetMappingConfig.deleteMany();
  await prisma.columnMappingConfig.deleteMany();
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

  // ========================================================================
  // 11. COLUMN MAPPING CONFIGS
  // ========================================================================

  await seedColumnMappings(PROJECT_IDS.banking, PROJECT_IDS.ecommerce);
  console.log('  Created column mapping configurations.');

  // ========================================================================
  // 12. DEMO CSV FILES (for Data Migration tab)
  // ========================================================================

  await seedDemoCSVFiles();
  console.log('  Created demo CSV files for data migration.');

  // ========================================================================
  // 13. DATA SHEET MAPPING CONFIGS (CSV Header → Source Column mappings)
  // ========================================================================

  await seedDataSheetMappings(PROJECT_IDS.banking, PROJECT_IDS.ecommerce);
  console.log('  Created data sheet mapping configurations.');

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
// Column Mapping Configurations
// ──────────────────────────────────────────────────────────────────────────────

async function seedColumnMappings(bankingId: string, ecommerceId: string) {
  // Helper to build SavedMappingData JSON
  function buildMappingJSON(
    columnMappings: Array<{
      sourceColumn: string;
      targetColumn: string;
      transformationType: string;
      castTo?: string;
      expression?: string;
      defaultValue?: string;
      nullHandling?: string;
    }>,
    sourceColumns: Array<{ name: string; dataType: string }>,
    targetColumns: Array<{ name: string; dataType: string }>,
  ): string {
    return JSON.stringify({
      columnMappings: columnMappings.map((cm, idx) => ({
        id: `seed-cm-${idx}`,
        sourceColumn: cm.sourceColumn,
        targetColumn: cm.targetColumn,
        transformationType: cm.transformationType || 'direct',
        castTo: cm.castTo,
        expression: cm.expression,
        defaultValue: cm.defaultValue,
        nullHandling: cm.nullHandling || 'pass',
        isValid: true,
      })),
      sourceColumns: sourceColumns.map((c, idx) => ({
        name: c.name,
        dataType: c.dataType,
        ordinalPosition: idx + 1,
        isNullable: true,
        isPrimaryKey: idx === 0,
        isUnique: false,
      })),
      targetColumns: targetColumns.map((c, idx) => ({
        name: c.name,
        dataType: c.dataType,
        ordinalPosition: idx + 1,
        isNullable: true,
        isPrimaryKey: idx === 0,
        isUnique: false,
      })),
    });
  }

  const mappings = [
    // ── Banking: PostgreSQL → MySQL ──────────────────────────────
    {
      projectId: bankingId,
      name: 'Customers → Customer Master',
      sourceTableName: 'customers',
      targetTableName: 'customer_master',
      sourceDialect: 'postgresql',
      targetDialect: 'mysql',
      mappings: buildMappingJSON(
        [
          { sourceColumn: 'id', targetColumn: 'customer_id', transformationType: 'rename' },
          { sourceColumn: 'first_name', targetColumn: 'fname', transformationType: 'rename' },
          { sourceColumn: 'last_name', targetColumn: 'lname', transformationType: 'rename' },
          { sourceColumn: 'email', targetColumn: 'email_address', transformationType: 'rename' },
          { sourceColumn: 'phone', targetColumn: 'phone_number', transformationType: 'rename' },
          { sourceColumn: 'date_of_birth', targetColumn: 'dob', transformationType: 'rename' },
          { sourceColumn: 'kyc_status', targetColumn: 'kyc_status', transformationType: 'direct' },
          { sourceColumn: 'risk_score', targetColumn: 'risk_level', transformationType: 'rename' },
          { sourceColumn: 'created_at', targetColumn: 'created_date', transformationType: 'cast', castTo: 'DATETIME' },
        ],
        [
          { name: 'id', dataType: 'uuid' },
          { name: 'first_name', dataType: 'varchar(100)' },
          { name: 'last_name', dataType: 'varchar(100)' },
          { name: 'email', dataType: 'varchar(255)' },
          { name: 'phone', dataType: 'varchar(20)' },
          { name: 'date_of_birth', dataType: 'date' },
          { name: 'kyc_status', dataType: 'varchar(20)' },
          { name: 'risk_score', dataType: 'integer' },
          { name: 'created_at', dataType: 'timestamp' },
        ],
        [
          { name: 'customer_id', dataType: 'varchar(36)' },
          { name: 'fname', dataType: 'varchar(100)' },
          { name: 'lname', dataType: 'varchar(100)' },
          { name: 'email_address', dataType: 'varchar(255)' },
          { name: 'phone_number', dataType: 'varchar(20)' },
          { name: 'dob', dataType: 'date' },
          { name: 'kyc_status', dataType: 'varchar(20)' },
          { name: 'risk_level', dataType: 'int' },
          { name: 'created_date', dataType: 'datetime' },
        ],
      ),
    },
    {
      projectId: bankingId,
      name: 'Accounts → Account Master',
      sourceTableName: 'accounts',
      targetTableName: 'account_master',
      sourceDialect: 'postgresql',
      targetDialect: 'mysql',
      mappings: buildMappingJSON(
        [
          { sourceColumn: 'id', targetColumn: 'account_id', transformationType: 'rename' },
          { sourceColumn: 'customer_id', targetColumn: 'cust_id', transformationType: 'rename' },
          { sourceColumn: 'account_number', targetColumn: 'acct_no', transformationType: 'rename' },
          { sourceColumn: 'account_type', targetColumn: 'acct_type', transformationType: 'rename' },
          { sourceColumn: 'currency', targetColumn: 'currency_code', transformationType: 'rename' },
          { sourceColumn: 'balance', targetColumn: 'current_balance', transformationType: 'rename' },
          { sourceColumn: 'status', targetColumn: 'acct_status', transformationType: 'rename' },
          { sourceColumn: 'opened_at', targetColumn: 'open_date', transformationType: 'cast', castTo: 'DATETIME' },
        ],
        [
          { name: 'id', dataType: 'uuid' },
          { name: 'customer_id', dataType: 'uuid' },
          { name: 'account_number', dataType: 'varchar(20)' },
          { name: 'account_type', dataType: 'varchar(30)' },
          { name: 'currency', dataType: 'char(3)' },
          { name: 'balance', dataType: 'decimal(18,2)' },
          { name: 'status', dataType: 'varchar(20)' },
          { name: 'opened_at', dataType: 'timestamp' },
        ],
        [
          { name: 'account_id', dataType: 'varchar(36)' },
          { name: 'cust_id', dataType: 'varchar(36)' },
          { name: 'acct_no', dataType: 'varchar(20)' },
          { name: 'acct_type', dataType: 'varchar(30)' },
          { name: 'currency_code', dataType: 'char(3)' },
          { name: 'current_balance', dataType: 'decimal(18,2)' },
          { name: 'acct_status', dataType: 'varchar(20)' },
          { name: 'open_date', dataType: 'datetime' },
        ],
      ),
    },
    {
      projectId: bankingId,
      name: 'Branches → Branch Info',
      sourceTableName: 'branches',
      targetTableName: 'branch_info',
      sourceDialect: 'postgresql',
      targetDialect: 'mysql',
      mappings: buildMappingJSON(
        [
          { sourceColumn: 'id', targetColumn: 'branch_id', transformationType: 'rename' },
          { sourceColumn: 'branch_code', targetColumn: 'code', transformationType: 'rename' },
          { sourceColumn: 'name', targetColumn: 'branch_name', transformationType: 'rename' },
          { sourceColumn: 'city', targetColumn: 'city', transformationType: 'direct' },
          { sourceColumn: 'country', targetColumn: 'country_code', transformationType: 'rename' },
          { sourceColumn: 'is_active', targetColumn: 'active_flag', transformationType: 'cast', castTo: 'TINYINT(1)' },
        ],
        [
          { name: 'id', dataType: 'uuid' },
          { name: 'branch_code', dataType: 'varchar(10)' },
          { name: 'name', dataType: 'varchar(200)' },
          { name: 'city', dataType: 'varchar(100)' },
          { name: 'country', dataType: 'char(2)' },
          { name: 'is_active', dataType: 'boolean' },
        ],
        [
          { name: 'branch_id', dataType: 'varchar(36)' },
          { name: 'code', dataType: 'varchar(10)' },
          { name: 'branch_name', dataType: 'varchar(200)' },
          { name: 'city', dataType: 'varchar(100)' },
          { name: 'country_code', dataType: 'char(2)' },
          { name: 'active_flag', dataType: 'tinyint(1)' },
        ],
      ),
    },
    {
      projectId: bankingId,
      name: 'Transactions → Transaction Log',
      sourceTableName: 'transactions',
      targetTableName: 'transaction_log',
      sourceDialect: 'postgresql',
      targetDialect: 'mysql',
      mappings: buildMappingJSON(
        [
          { sourceColumn: 'id', targetColumn: 'txn_id', transformationType: 'rename' },
          { sourceColumn: 'account_id', targetColumn: 'acct_id', transformationType: 'rename' },
          { sourceColumn: 'transaction_type', targetColumn: 'txn_type', transformationType: 'rename' },
          { sourceColumn: 'amount', targetColumn: 'txn_amount', transformationType: 'rename' },
          { sourceColumn: 'currency', targetColumn: 'currency_code', transformationType: 'rename' },
          { sourceColumn: 'description', targetColumn: 'txn_description', transformationType: 'rename' },
          { sourceColumn: 'reference_number', targetColumn: 'ref_no', transformationType: 'rename' },
          { sourceColumn: 'status', targetColumn: 'txn_status', transformationType: 'direct' },
          { sourceColumn: 'created_at', targetColumn: 'txn_date', transformationType: 'cast', castTo: 'DATETIME' },
        ],
        [
          { name: 'id', dataType: 'uuid' },
          { name: 'account_id', dataType: 'uuid' },
          { name: 'transaction_type', dataType: 'varchar(30)' },
          { name: 'amount', dataType: 'decimal(18,2)' },
          { name: 'currency', dataType: 'char(3)' },
          { name: 'description', dataType: 'varchar(500)' },
          { name: 'reference_number', dataType: 'varchar(50)' },
          { name: 'status', dataType: 'varchar(20)' },
          { name: 'created_at', dataType: 'timestamp' },
        ],
        [
          { name: 'txn_id', dataType: 'varchar(36)' },
          { name: 'acct_id', dataType: 'varchar(36)' },
          { name: 'txn_type', dataType: 'varchar(30)' },
          { name: 'txn_amount', dataType: 'decimal(18,2)' },
          { name: 'currency_code', dataType: 'char(3)' },
          { name: 'txn_description', dataType: 'varchar(500)' },
          { name: 'ref_no', dataType: 'varchar(50)' },
          { name: 'txn_status', dataType: 'varchar(20)' },
          { name: 'txn_date', dataType: 'datetime' },
        ],
      ),
    },

    // ── E-Commerce: MySQL → PostgreSQL ─────────────────────────
    {
      projectId: ecommerceId,
      name: 'Users → App Users',
      sourceTableName: 'users',
      targetTableName: 'app_users',
      sourceDialect: 'mysql',
      targetDialect: 'postgresql',
      mappings: buildMappingJSON(
        [
          { sourceColumn: 'id', targetColumn: 'user_id', transformationType: 'cast', castTo: 'BIGINT' },
          { sourceColumn: 'username', targetColumn: 'login_name', transformationType: 'rename' },
          { sourceColumn: 'email', targetColumn: 'email_address', transformationType: 'rename' },
          { sourceColumn: 'full_name', targetColumn: 'display_name', transformationType: 'rename' },
          { sourceColumn: 'role', targetColumn: 'user_role', transformationType: 'rename' },
          { sourceColumn: 'is_verified', targetColumn: 'verified', transformationType: 'cast', castTo: 'BOOLEAN' },
          { sourceColumn: 'created_at', targetColumn: 'registered_at', transformationType: 'cast', castTo: 'TIMESTAMP' },
        ],
        [
          { name: 'id', dataType: 'bigint' },
          { name: 'username', dataType: 'varchar(50)' },
          { name: 'email', dataType: 'varchar(255)' },
          { name: 'full_name', dataType: 'varchar(200)' },
          { name: 'role', dataType: "enum('customer','admin','vendor')" },
          { name: 'is_verified', dataType: 'tinyint(1)' },
          { name: 'created_at', dataType: 'datetime' },
        ],
        [
          { name: 'user_id', dataType: 'bigint' },
          { name: 'login_name', dataType: 'varchar(50)' },
          { name: 'email_address', dataType: 'varchar(255)' },
          { name: 'display_name', dataType: 'varchar(200)' },
          { name: 'user_role', dataType: 'varchar(20)' },
          { name: 'verified', dataType: 'boolean' },
          { name: 'registered_at', dataType: 'timestamp' },
        ],
      ),
    },
    {
      projectId: ecommerceId,
      name: 'Products → Product Catalog',
      sourceTableName: 'products',
      targetTableName: 'product_catalog',
      sourceDialect: 'mysql',
      targetDialect: 'postgresql',
      mappings: buildMappingJSON(
        [
          { sourceColumn: 'id', targetColumn: 'product_id', transformationType: 'cast', castTo: 'BIGINT' },
          { sourceColumn: 'sku', targetColumn: 'product_sku', transformationType: 'rename' },
          { sourceColumn: 'name', targetColumn: 'product_name', transformationType: 'rename' },
          { sourceColumn: 'description', targetColumn: 'product_desc', transformationType: 'rename' },
          { sourceColumn: 'price', targetColumn: 'retail_price', transformationType: 'rename' },
          { sourceColumn: 'cost_price', targetColumn: 'cost', transformationType: 'rename', nullHandling: 'default', defaultValue: '0.00' },
          { sourceColumn: 'stock_quantity', targetColumn: 'qty_on_hand', transformationType: 'rename' },
          { sourceColumn: 'status', targetColumn: 'product_status', transformationType: 'rename' },
          { sourceColumn: 'created_at', targetColumn: 'created_at', transformationType: 'cast', castTo: 'TIMESTAMP' },
        ],
        [
          { name: 'id', dataType: 'bigint' },
          { name: 'sku', dataType: 'varchar(50)' },
          { name: 'name', dataType: 'varchar(300)' },
          { name: 'description', dataType: 'text' },
          { name: 'price', dataType: 'decimal(10,2)' },
          { name: 'cost_price', dataType: 'decimal(10,2)' },
          { name: 'stock_quantity', dataType: 'int' },
          { name: 'status', dataType: "enum('active','draft','archived')" },
          { name: 'created_at', dataType: 'datetime' },
        ],
        [
          { name: 'product_id', dataType: 'bigint' },
          { name: 'product_sku', dataType: 'varchar(50)' },
          { name: 'product_name', dataType: 'varchar(300)' },
          { name: 'product_desc', dataType: 'text' },
          { name: 'retail_price', dataType: 'decimal(10,2)' },
          { name: 'cost', dataType: 'decimal(10,2)' },
          { name: 'qty_on_hand', dataType: 'integer' },
          { name: 'product_status', dataType: 'varchar(20)' },
          { name: 'created_at', dataType: 'timestamp' },
        ],
      ),
    },
    {
      projectId: ecommerceId,
      name: 'Orders → Order Records',
      sourceTableName: 'orders',
      targetTableName: 'order_records',
      sourceDialect: 'mysql',
      targetDialect: 'postgresql',
      mappings: buildMappingJSON(
        [
          { sourceColumn: 'id', targetColumn: 'order_id', transformationType: 'cast', castTo: 'BIGINT' },
          { sourceColumn: 'user_id', targetColumn: 'customer_id', transformationType: 'rename' },
          { sourceColumn: 'order_number', targetColumn: 'order_ref', transformationType: 'rename' },
          { sourceColumn: 'status', targetColumn: 'order_status', transformationType: 'rename' },
          { sourceColumn: 'subtotal', targetColumn: 'subtotal', transformationType: 'direct' },
          { sourceColumn: 'tax_amount', targetColumn: 'tax', transformationType: 'rename' },
          { sourceColumn: 'total_amount', targetColumn: 'grand_total', transformationType: 'rename' },
          { sourceColumn: 'ordered_at', targetColumn: 'placed_at', transformationType: 'cast', castTo: 'TIMESTAMP' },
        ],
        [
          { name: 'id', dataType: 'bigint' },
          { name: 'user_id', dataType: 'bigint' },
          { name: 'order_number', dataType: 'varchar(30)' },
          { name: 'status', dataType: "enum('pending','processing','shipped','delivered','cancelled')" },
          { name: 'subtotal', dataType: 'decimal(12,2)' },
          { name: 'tax_amount', dataType: 'decimal(10,2)' },
          { name: 'total_amount', dataType: 'decimal(12,2)' },
          { name: 'ordered_at', dataType: 'datetime' },
        ],
        [
          { name: 'order_id', dataType: 'bigint' },
          { name: 'customer_id', dataType: 'bigint' },
          { name: 'order_ref', dataType: 'varchar(30)' },
          { name: 'order_status', dataType: 'varchar(20)' },
          { name: 'subtotal', dataType: 'decimal(12,2)' },
          { name: 'tax', dataType: 'decimal(10,2)' },
          { name: 'grand_total', dataType: 'decimal(12,2)' },
          { name: 'placed_at', dataType: 'timestamp' },
        ],
      ),
    },
    {
      projectId: ecommerceId,
      name: 'Order Items → Order Line Items',
      sourceTableName: 'order_items',
      targetTableName: 'order_line_items',
      sourceDialect: 'mysql',
      targetDialect: 'postgresql',
      mappings: buildMappingJSON(
        [
          { sourceColumn: 'id', targetColumn: 'line_id', transformationType: 'cast', castTo: 'BIGINT' },
          { sourceColumn: 'order_id', targetColumn: 'order_id', transformationType: 'direct' },
          { sourceColumn: 'product_id', targetColumn: 'product_id', transformationType: 'direct' },
          { sourceColumn: 'quantity', targetColumn: 'qty', transformationType: 'rename' },
          { sourceColumn: 'unit_price', targetColumn: 'price_each', transformationType: 'rename' },
          { sourceColumn: 'total_price', targetColumn: 'line_total', transformationType: 'rename' },
          { sourceColumn: 'discount_pct', targetColumn: 'discount_percent', transformationType: 'rename', nullHandling: 'default', defaultValue: '0.00' },
        ],
        [
          { name: 'id', dataType: 'bigint' },
          { name: 'order_id', dataType: 'bigint' },
          { name: 'product_id', dataType: 'bigint' },
          { name: 'quantity', dataType: 'int' },
          { name: 'unit_price', dataType: 'decimal(10,2)' },
          { name: 'total_price', dataType: 'decimal(12,2)' },
          { name: 'discount_pct', dataType: 'decimal(5,2)' },
        ],
        [
          { name: 'line_id', dataType: 'bigint' },
          { name: 'order_id', dataType: 'bigint' },
          { name: 'product_id', dataType: 'bigint' },
          { name: 'qty', dataType: 'integer' },
          { name: 'price_each', dataType: 'decimal(10,2)' },
          { name: 'line_total', dataType: 'decimal(12,2)' },
          { name: 'discount_percent', dataType: 'decimal(5,2)' },
        ],
      ),
    },
  ];

  for (const m of mappings) {
    await prisma.columnMappingConfig.create({ data: m });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Demo CSV Files for Data Migration
// ──────────────────────────────────────────────────────────────────────────────

async function seedDemoCSVFiles() {
  const csvDir = path.resolve('./uploads/demo-csv');
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
  }

  // Banking: customers_export.csv
  // CSV headers intentionally differ from DB columns to demonstrate data sheet mapping
  const customersCSV = `Customer ID,First Name,Last Name,Email Address,Phone,DOB,KYC Status,Risk Score,Registration Date
a1b2c3d4-e5f6-4789-abcd-000000000001,Alice,Johnson,alice.johnson@example.com,+1-555-0101,1985-03-15,verified,72,2023-01-15 09:30:00
a1b2c3d4-e5f6-4789-abcd-000000000002,Bob,Smith,bob.smith@example.com,+1-555-0102,1990-07-22,verified,45,2023-02-20 14:15:00
a1b2c3d4-e5f6-4789-abcd-000000000003,Carol,Williams,carol.w@example.com,+1-555-0103,1978-11-08,pending,88,2023-03-10 11:00:00
a1b2c3d4-e5f6-4789-abcd-000000000004,David,Brown,david.brown@example.com,,1995-01-30,verified,30,2023-04-05 16:45:00
a1b2c3d4-e5f6-4789-abcd-000000000005,Eva,Martinez,eva.m@example.com,+1-555-0105,1988-06-12,verified,55,2023-04-18 08:20:00
a1b2c3d4-e5f6-4789-abcd-000000000006,Frank,Garcia,frank.garcia@example.com,+1-555-0106,1972-09-25,enhanced,91,2023-05-01 10:30:00
a1b2c3d4-e5f6-4789-abcd-000000000007,Grace,Lee,grace.lee@example.com,+1-555-0107,1993-12-03,verified,38,2023-05-22 13:00:00
a1b2c3d4-e5f6-4789-abcd-000000000008,Henry,Wilson,henry.w@example.com,+1-555-0108,1980-04-17,verified,62,2023-06-10 09:45:00
a1b2c3d4-e5f6-4789-abcd-000000000009,Iris,Anderson,iris.anderson@example.com,+1-555-0109,1997-08-28,pending,25,2023-07-03 15:30:00
a1b2c3d4-e5f6-4789-abcd-000000000010,Jack,Thomas,jack.thomas@example.com,+1-555-0110,1983-02-14,verified,70,2023-07-20 11:15:00
a1b2c3d4-e5f6-4789-abcd-000000000011,Karen,Jackson,karen.j@example.com,,1991-10-09,verified,48,2023-08-05 14:00:00
a1b2c3d4-e5f6-4789-abcd-000000000012,Leo,White,leo.white@example.com,+1-555-0112,1976-05-20,enhanced,85,2023-08-28 16:30:00
a1b2c3d4-e5f6-4789-abcd-000000000013,Maria,Harris,maria.harris@example.com,+1-555-0113,1999-01-07,verified,33,2023-09-12 10:00:00
a1b2c3d4-e5f6-4789-abcd-000000000014,Nick,Clark,nick.clark@example.com,+1-555-0114,1987-07-31,verified,57,2023-10-01 08:45:00
a1b2c3d4-e5f6-4789-abcd-000000000015,Olivia,Lewis,olivia.lewis@example.com,+1-555-0115,1994-03-22,pending,42,2023-10-15 12:30:00
a1b2c3d4-e5f6-4789-abcd-000000000016,Peter,Robinson,peter.r@example.com,+1-555-0116,1981-11-14,verified,65,2023-11-02 09:15:00
a1b2c3d4-e5f6-4789-abcd-000000000017,Quinn,Walker,quinn.walker@example.com,,1996-06-08,verified,28,2023-11-18 14:45:00
a1b2c3d4-e5f6-4789-abcd-000000000018,Rachel,Hall,rachel.hall@example.com,+1-555-0118,1974-08-19,enhanced,93,2023-12-05 11:30:00
a1b2c3d4-e5f6-4789-abcd-000000000019,Sam,Young,sam.young@example.com,+1-555-0119,1989-12-25,verified,51,2024-01-10 08:00:00
a1b2c3d4-e5f6-4789-abcd-000000000020,Tina,King,tina.king@example.com,+1-555-0120,1992-04-01,verified,44,2024-01-28 15:00:00`;

  // Banking: accounts_export.csv
  const accountsCSV = `Account ID,Customer ID,Account Number,Account Type,Currency,Balance,Status,Opened At
b1b2c3d4-e5f6-4789-abcd-000000000001,a1b2c3d4-e5f6-4789-abcd-000000000001,ACC-2023-00001,savings,USD,45230.50,active,2023-01-15 10:00:00
b1b2c3d4-e5f6-4789-abcd-000000000002,a1b2c3d4-e5f6-4789-abcd-000000000001,ACC-2023-00002,checking,USD,12800.75,active,2023-01-15 10:05:00
b1b2c3d4-e5f6-4789-abcd-000000000003,a1b2c3d4-e5f6-4789-abcd-000000000002,ACC-2023-00003,savings,USD,8920.00,active,2023-02-20 14:30:00
b1b2c3d4-e5f6-4789-abcd-000000000004,a1b2c3d4-e5f6-4789-abcd-000000000003,ACC-2023-00004,checking,EUR,35100.25,active,2023-03-10 11:30:00
b1b2c3d4-e5f6-4789-abcd-000000000005,a1b2c3d4-e5f6-4789-abcd-000000000003,ACC-2023-00005,savings,EUR,92500.00,active,2023-03-10 11:35:00
b1b2c3d4-e5f6-4789-abcd-000000000006,a1b2c3d4-e5f6-4789-abcd-000000000004,ACC-2023-00006,checking,USD,3240.80,active,2023-04-05 17:00:00
b1b2c3d4-e5f6-4789-abcd-000000000007,a1b2c3d4-e5f6-4789-abcd-000000000005,ACC-2023-00007,savings,USD,67890.15,active,2023-04-18 08:30:00
b1b2c3d4-e5f6-4789-abcd-000000000008,a1b2c3d4-e5f6-4789-abcd-000000000006,ACC-2023-00008,checking,GBP,128500.00,active,2023-05-01 10:45:00
b1b2c3d4-e5f6-4789-abcd-000000000009,a1b2c3d4-e5f6-4789-abcd-000000000006,ACC-2023-00009,savings,GBP,245000.50,active,2023-05-01 10:50:00
b1b2c3d4-e5f6-4789-abcd-000000000010,a1b2c3d4-e5f6-4789-abcd-000000000007,ACC-2023-00010,checking,USD,5670.30,active,2023-05-22 13:15:00
b1b2c3d4-e5f6-4789-abcd-000000000011,a1b2c3d4-e5f6-4789-abcd-000000000008,ACC-2023-00011,savings,USD,23400.90,active,2023-06-10 10:00:00
b1b2c3d4-e5f6-4789-abcd-000000000012,a1b2c3d4-e5f6-4789-abcd-000000000009,ACC-2023-00012,checking,USD,1580.45,active,2023-07-03 15:45:00
b1b2c3d4-e5f6-4789-abcd-000000000013,a1b2c3d4-e5f6-4789-abcd-000000000010,ACC-2023-00013,savings,USD,89750.00,active,2023-07-20 11:30:00
b1b2c3d4-e5f6-4789-abcd-000000000014,a1b2c3d4-e5f6-4789-abcd-000000000010,ACC-2023-00014,checking,USD,15200.60,active,2023-07-20 11:35:00
b1b2c3d4-e5f6-4789-abcd-000000000015,a1b2c3d4-e5f6-4789-abcd-000000000011,ACC-2023-00015,savings,CAD,41000.00,active,2023-08-05 14:15:00
b1b2c3d4-e5f6-4789-abcd-000000000016,a1b2c3d4-e5f6-4789-abcd-000000000012,ACC-2023-00016,checking,USD,178900.75,active,2023-08-28 16:45:00
b1b2c3d4-e5f6-4789-abcd-000000000017,a1b2c3d4-e5f6-4789-abcd-000000000013,ACC-2023-00017,savings,USD,6300.20,active,2023-09-12 10:15:00
b1b2c3d4-e5f6-4789-abcd-000000000018,a1b2c3d4-e5f6-4789-abcd-000000000014,ACC-2023-00018,checking,USD,27650.00,active,2023-10-01 09:00:00
b1b2c3d4-e5f6-4789-abcd-000000000019,a1b2c3d4-e5f6-4789-abcd-000000000015,ACC-2023-00019,savings,USD,11200.35,active,2023-10-15 12:45:00
b1b2c3d4-e5f6-4789-abcd-000000000020,a1b2c3d4-e5f6-4789-abcd-000000000016,ACC-2023-00020,checking,EUR,53800.90,active,2023-11-02 09:30:00`;

  // Banking: branches_export.csv
  const branchesCSV = `Branch ID,Branch Code,Branch Name,City,Country,Is Active
c1b2c3d4-e5f6-4789-abcd-000000000001,HQ-001,Main Headquarters,New York,US,true
c1b2c3d4-e5f6-4789-abcd-000000000002,NYC-002,Manhattan Downtown,New York,US,true
c1b2c3d4-e5f6-4789-abcd-000000000003,LAX-001,Los Angeles Central,Los Angeles,US,true
c1b2c3d4-e5f6-4789-abcd-000000000004,CHI-001,Chicago Loop,Chicago,US,true
c1b2c3d4-e5f6-4789-abcd-000000000005,LON-001,London City,London,GB,true
c1b2c3d4-e5f6-4789-abcd-000000000006,LON-002,London Canary Wharf,London,GB,true
c1b2c3d4-e5f6-4789-abcd-000000000007,FRA-001,Frankfurt Main,Frankfurt,DE,true
c1b2c3d4-e5f6-4789-abcd-000000000008,SIN-001,Singapore Central,Singapore,SG,true
c1b2c3d4-e5f6-4789-abcd-000000000009,TOR-001,Toronto Downtown,Toronto,CA,true
c1b2c3d4-e5f6-4789-abcd-000000000010,SYD-001,Sydney CBD,Sydney,AU,false`;

  // E-Commerce: users_export.csv
  const usersCSV = `User ID,User Name,Email,Full Name,User Role,Verified,Signup Date
1001,alice_shop,alice@shopmail.com,Alice Thompson,customer,1,2023-01-10 08:30:00
1002,bob_buyer,bob.b@shopmail.com,Bob Martinez,customer,1,2023-01-22 14:00:00
1003,carol_admin,carol@company.com,Carol Chen,admin,1,2023-02-05 09:00:00
1004,dave_vendor,dave@vendorco.com,David Patel,vendor,1,2023-02-18 11:30:00
1005,emma_shop,emma.s@email.com,Emma Wilson,customer,0,2023-03-01 16:45:00
1006,frank_buy,frank@email.com,Frank Lee,customer,1,2023-03-15 10:15:00
1007,grace_vendor,grace@craftstore.com,Grace Kim,vendor,1,2023-04-02 13:00:00
1008,henry_shop,henry.h@email.com,Henry Brown,customer,1,2023-04-20 08:45:00
1009,iris_buy,iris@webmail.com,Iris Johnson,customer,1,2023-05-08 15:30:00
1010,jack_admin,jack@company.com,Jack Davis,admin,1,2023-05-22 09:30:00
1011,kate_shop,kate.s@email.com,Kate Taylor,customer,0,2023-06-10 14:00:00
1012,leo_vendor,leo@artisanal.com,Leo Anderson,vendor,1,2023-07-01 11:00:00
1013,mia_buy,mia@email.com,Mia Garcia,customer,1,2023-07-18 16:30:00
1014,noah_shop,noah.n@email.com,Noah White,customer,1,2023-08-05 08:15:00
1015,olivia_buy,olivia@webmail.com,Olivia Martin,customer,1,2023-08-22 12:45:00`;

  // E-Commerce: products_export.csv
  const productsCSV = `Product ID,SKU,Product Name,Description,Price,Cost Price,Stock Qty,Status,Created
2001,WDG-BLU-001,Wireless Bluetooth Speaker,Premium portable speaker with 20hr battery,79.99,32.50,145,active,2023-01-05 10:00:00
2002,PHN-CSE-002,Premium Phone Case,Shockproof case with wireless charging support,29.99,8.75,520,active,2023-01-12 11:30:00
2003,LPT-STD-003,Laptop Stand Adjustable,Ergonomic aluminum laptop stand,49.99,18.00,88,active,2023-02-01 09:00:00
2004,KBD-MEC-004,Mechanical Keyboard RGB,Cherry MX switches with per-key RGB,129.99,52.00,67,active,2023-02-15 14:00:00
2005,MSE-WLS-005,Wireless Ergonomic Mouse,Vertical design reduces wrist strain,39.99,14.50,230,active,2023-03-01 08:30:00
2006,HDN-ANC-006,Noise Cancelling Headphones,ANC with 30hr battery and Hi-Res audio,199.99,78.00,42,active,2023-03-20 10:45:00
2007,CHG-USB-007,USB-C Fast Charger 65W,GaN charger for laptops and phones,34.99,12.00,380,active,2023-04-05 11:00:00
2008,CBL-USB-008,Braided USB-C Cable 2m,Premium nylon braided cable,12.99,3.50,890,active,2023-04-10 09:30:00
2009,MNT-4K-009,4K Monitor 27 inch,IPS panel with USB-C hub,449.99,210.00,25,active,2023-05-01 13:00:00
2010,WCM-HD-010,HD Webcam 1080p,Auto-focus with built-in mic,59.99,22.00,156,active,2023-05-15 08:00:00
2011,SPK-DSK-011,Desktop Speakers Pair,2.0 channel with wooden enclosure,69.99,28.00,73,active,2023-06-01 10:30:00
2012,HUB-USB-012,USB-C Hub 7-in-1,HDMI + USB-A + SD card reader,44.99,16.50,195,active,2023-06-20 14:15:00
2013,PAD-MSE-013,XL Gaming Mouse Pad,900x400mm extended desk mat,19.99,4.00,410,active,2023-07-05 09:00:00
2014,ARM-MNT-014,Monitor Arm Single,Gas spring desk mount,79.99,30.00,62,active,2023-07-25 11:30:00
2015,BAG-LPT-015,Laptop Backpack 15.6",Water resistant with USB port,54.99,20.00,8,active,2023-08-10 08:45:00
2016,DNG-BLU-016,Bluetooth Dongle 5.3,Low latency USB adapter,14.99,3.00,640,active,2023-08-25 10:00:00
2017,WRS-RST-017,Ergonomic Wrist Rest,Memory foam keyboard rest,17.99,5.50,310,active,2023-09-10 14:30:00
2018,LGT-DSK-018,LED Desk Lamp,Touch dimmer with USB charging port,39.99,15.00,4,active,2023-10-01 09:15:00
2019,TPD-WLS-019,Wireless Trackpad,Multi-touch gestures for desktop,49.99,18.00,0,archived,2023-10-20 11:00:00
2020,CAM-PTZ-020,PTZ Conference Camera,4K with remote pan/tilt/zoom,299.99,135.00,15,draft,2023-11-05 13:30:00`;

  // Write all CSV files
  const csvFiles: Record<string, string> = {
    'customers_export.csv': customersCSV,
    'accounts_export.csv': accountsCSV,
    'branches_export.csv': branchesCSV,
    'users_export.csv': usersCSV,
    'products_export.csv': productsCSV,
  };

  for (const [filename, content] of Object.entries(csvFiles)) {
    fs.writeFileSync(path.join(csvDir, filename), content, 'utf-8');
  }

  console.log(`    Written ${Object.keys(csvFiles).length} CSV files to ${csvDir}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Data Sheet Mapping Configs (CSV Header → Source Column)
// ──────────────────────────────────────────────────────────────────────────────

async function seedDataSheetMappings(bankingId: string, ecommerceId: string) {
  const configs = [
    {
      projectId: bankingId,
      name: 'Customers CSV Import',
      sourceTableName: 'customers',
      csvFileName: 'customers_export.csv',
      mappings: JSON.stringify([
        { csvHeader: 'Customer ID', sourceColumn: 'id' },
        { csvHeader: 'First Name', sourceColumn: 'first_name' },
        { csvHeader: 'Last Name', sourceColumn: 'last_name' },
        { csvHeader: 'Email Address', sourceColumn: 'email' },
        { csvHeader: 'Phone', sourceColumn: 'phone' },
        { csvHeader: 'DOB', sourceColumn: 'date_of_birth' },
        { csvHeader: 'KYC Status', sourceColumn: 'kyc_status' },
        { csvHeader: 'Risk Score', sourceColumn: 'risk_score' },
        { csvHeader: 'Registration Date', sourceColumn: 'created_at' },
      ]),
    },
    {
      projectId: bankingId,
      name: 'Accounts CSV Import',
      sourceTableName: 'accounts',
      csvFileName: 'accounts_export.csv',
      mappings: JSON.stringify([
        { csvHeader: 'Account ID', sourceColumn: 'id' },
        { csvHeader: 'Customer ID', sourceColumn: 'customer_id' },
        { csvHeader: 'Account Number', sourceColumn: 'account_number' },
        { csvHeader: 'Account Type', sourceColumn: 'account_type' },
        { csvHeader: 'Currency', sourceColumn: 'currency' },
        { csvHeader: 'Balance', sourceColumn: 'balance' },
        { csvHeader: 'Status', sourceColumn: 'status' },
        { csvHeader: 'Opened At', sourceColumn: 'opened_at' },
      ]),
    },
    {
      projectId: bankingId,
      name: 'Branches CSV Import',
      sourceTableName: 'branches',
      csvFileName: 'branches_export.csv',
      mappings: JSON.stringify([
        { csvHeader: 'Branch ID', sourceColumn: 'id' },
        { csvHeader: 'Branch Code', sourceColumn: 'branch_code' },
        { csvHeader: 'Branch Name', sourceColumn: 'branch_name' },
        { csvHeader: 'City', sourceColumn: 'city' },
        { csvHeader: 'Country', sourceColumn: 'country' },
        { csvHeader: 'Is Active', sourceColumn: 'is_active' },
      ]),
    },
    {
      projectId: ecommerceId,
      name: 'Users CSV Import',
      sourceTableName: 'users',
      csvFileName: 'users_export.csv',
      mappings: JSON.stringify([
        { csvHeader: 'User ID', sourceColumn: 'user_id' },
        { csvHeader: 'User Name', sourceColumn: 'username' },
        { csvHeader: 'Email', sourceColumn: 'email' },
        { csvHeader: 'Full Name', sourceColumn: 'full_name' },
        { csvHeader: 'User Role', sourceColumn: 'role' },
        { csvHeader: 'Verified', sourceColumn: 'is_verified' },
        { csvHeader: 'Signup Date', sourceColumn: 'created_at' },
      ]),
    },
    {
      projectId: ecommerceId,
      name: 'Products CSV Import',
      sourceTableName: 'products',
      csvFileName: 'products_export.csv',
      mappings: JSON.stringify([
        { csvHeader: 'Product ID', sourceColumn: 'product_id' },
        { csvHeader: 'SKU', sourceColumn: 'sku' },
        { csvHeader: 'Product Name', sourceColumn: 'name' },
        { csvHeader: 'Description', sourceColumn: 'description' },
        { csvHeader: 'Price', sourceColumn: 'price' },
        { csvHeader: 'Cost Price', sourceColumn: 'cost' },
        { csvHeader: 'Stock Qty', sourceColumn: 'stock_quantity' },
        { csvHeader: 'Status', sourceColumn: 'status' },
        { csvHeader: 'Created', sourceColumn: 'created_at' },
      ]),
    },
  ];

  for (const cfg of configs) {
    await prisma.dataSheetMappingConfig.create({ data: cfg });
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

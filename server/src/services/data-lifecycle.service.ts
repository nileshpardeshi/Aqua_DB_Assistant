import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ── Configuration shape stored as JSON in the configuration column ──────────

export interface RuleConfiguration {
  retentionPeriod: number;
  retentionUnit: 'days' | 'months' | 'years';
  retentionColumn: string;
  conditions: RuleCondition[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  cascadeDelete: boolean;
  backupBeforePurge: boolean;
  notifyOnExecution: boolean;
  sqlDialect: string;
}

export interface RuleCondition {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IS NULL' | 'IS NOT NULL' | 'LIKE' | 'IN';
  value: string;
  conjunction: 'AND' | 'OR';
}

// ---------- Create Rule ----------

export async function createRule(data: {
  projectId: string;
  ruleName: string;
  ruleType: string;
  targetTable: string;
  targetColumns?: string;
  configuration: string;
  isActive?: boolean;
}) {
  const rule = await prisma.dataLifecycleRule.create({
    data: {
      projectId: data.projectId,
      ruleName: data.ruleName,
      ruleType: data.ruleType,
      targetTable: data.targetTable,
      targetColumns: data.targetColumns ?? null,
      configuration: data.configuration,
      isActive: data.isActive ?? true,
    },
  });

  return rule;
}

// ---------- List Rules ----------

export async function listRules(projectId: string) {
  const rules = await prisma.dataLifecycleRule.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return rules;
}

// ---------- Get Rule ----------

export async function getRule(id: string) {
  const rule = await prisma.dataLifecycleRule.findUnique({
    where: { id },
  });

  if (!rule) {
    throw new NotFoundError('DataLifecycleRule');
  }

  return rule;
}

// ---------- Update Rule ----------

export async function updateRule(
  id: string,
  data: {
    ruleName?: string;
    ruleType?: string;
    targetTable?: string;
    targetColumns?: string;
    configuration?: string;
    isActive?: boolean;
  },
) {
  const existing = await prisma.dataLifecycleRule.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('DataLifecycleRule');
  }

  const rule = await prisma.dataLifecycleRule.update({
    where: { id },
    data,
  });

  return rule;
}

// ---------- Delete Rule ----------

export async function deleteRule(id: string) {
  const existing = await prisma.dataLifecycleRule.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('DataLifecycleRule');
  }

  await prisma.dataLifecycleRule.delete({ where: { id } });

  return existing;
}

// ---------- Generate Purge Script ----------

export async function generatePurgeScript(
  ruleId: string,
  options: { batchSize?: number; dryRun?: boolean; dialect?: string } = {},
) {
  const rule = await prisma.dataLifecycleRule.findUnique({
    where: { id: ruleId },
  });

  if (!rule) {
    throw new NotFoundError('DataLifecycleRule');
  }

  let config: RuleConfiguration;
  try {
    config = JSON.parse(rule.configuration) as RuleConfiguration;
  } catch {
    config = {
      retentionPeriod: 90,
      retentionUnit: 'days',
      retentionColumn: 'created_at',
      conditions: [],
      priority: 'medium',
      cascadeDelete: false,
      backupBeforePurge: false,
      notifyOnExecution: false,
      sqlDialect: 'postgresql',
    };
  }

  const batchSize = options.batchSize ?? 1000;
  const dryRun = options.dryRun ?? true;
  const dialect = options.dialect ?? config.sqlDialect ?? 'postgresql';
  const tableName = rule.targetTable;
  const retentionColumn = config.retentionColumn ?? 'created_at';

  // Build date expression based on dialect
  const dateExpr = buildDateExpression(config, dialect);

  // Build WHERE clause with conditions
  const whereParts: string[] = [`${retentionColumn} < ${dateExpr}`];
  if (config.conditions && config.conditions.length > 0) {
    for (const cond of config.conditions) {
      const conj = cond.conjunction ?? 'AND';
      if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
        whereParts.push(`${conj} ${cond.column} ${cond.operator}`);
      } else if (cond.operator === 'IN') {
        whereParts.push(`${conj} ${cond.column} IN (${cond.value})`);
      } else {
        whereParts.push(`${conj} ${cond.column} ${cond.operator} '${cond.value}'`);
      }
    }
  }

  const whereClause = whereParts.join('\n    ');

  if (dryRun) {
    return buildDryRunScript(rule.ruleName, tableName, config, whereClause, batchSize, dialect);
  }

  return buildLiveScript(rule.ruleName, tableName, config, whereClause, batchSize, dialect);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDateExpression(config: RuleConfiguration, dialect: string): string {
  const { retentionPeriod, retentionUnit } = config;

  switch (dialect) {
    case 'mysql':
    case 'mariadb':
      return `DATE_SUB(NOW(), INTERVAL ${retentionPeriod} ${retentionUnit.toUpperCase().replace(/S$/, '')})`;

    case 'sqlserver': {
      const unit = retentionUnit === 'days' ? 'DAY' : retentionUnit === 'months' ? 'MONTH' : 'YEAR';
      return `DATEADD(${unit}, -${retentionPeriod}, GETDATE())`;
    }

    case 'oracle':
      if (retentionUnit === 'days') return `SYSDATE - ${retentionPeriod}`;
      if (retentionUnit === 'months') return `ADD_MONTHS(SYSDATE, -${retentionPeriod})`;
      return `ADD_MONTHS(SYSDATE, -${retentionPeriod * 12})`;

    case 'sqlite':
      return `DATE('now', '-${retentionPeriod} ${retentionUnit}')`;

    case 'postgresql':
    default:
      return `NOW() - INTERVAL '${retentionPeriod} ${retentionUnit}'`;
  }
}

function buildDryRunScript(
  ruleName: string,
  tableName: string,
  config: RuleConfiguration,
  whereClause: string,
  batchSize: number,
  dialect: string,
) {
  const lines = [
    `-- =====================================================`,
    `-- DRY RUN: Purge Analysis for "${ruleName}"`,
    `-- =====================================================`,
    `-- Target table: ${tableName}`,
    `-- Retention: ${config.retentionPeriod} ${config.retentionUnit} on column "${config.retentionColumn}"`,
    `-- Batch size: ${batchSize.toLocaleString()}`,
    `-- Dialect: ${dialect}`,
    `-- Generated at: ${new Date().toISOString()}`,
    `-- Mode: DRY RUN (no data will be modified)`,
    ``,
    `-- Step 1: Count total rows eligible for purging`,
    `SELECT COUNT(*) AS rows_to_purge`,
    `FROM ${tableName}`,
    `WHERE ${whereClause};`,
    ``,
    `-- Step 2: Analyze data distribution by date`,
    `SELECT`,
  ];

  if (dialect === 'sqlite') {
    lines.push(`    strftime('%Y-%m', ${config.retentionColumn}) AS period,`);
  } else if (dialect === 'mysql' || dialect === 'mariadb') {
    lines.push(`    DATE_FORMAT(${config.retentionColumn}, '%Y-%m') AS period,`);
  } else {
    lines.push(`    TO_CHAR(${config.retentionColumn}, 'YYYY-MM') AS period,`);
  }

  lines.push(
    `    COUNT(*) AS row_count`,
    `FROM ${tableName}`,
    `WHERE ${whereClause}`,
    `GROUP BY period`,
    `ORDER BY period;`,
    ``,
    `-- Step 3: Preview sample rows to be purged (first 25)`,
    `SELECT *`,
    `FROM ${tableName}`,
    `WHERE ${whereClause}`,
    `ORDER BY ${config.retentionColumn} ASC`,
    `LIMIT 25;`,
    ``,
    `-- Step 4: Check foreign key dependencies`,
  );

  if (dialect === 'postgresql') {
    lines.push(
      `SELECT`,
      `    tc.table_name AS referencing_table,`,
      `    kcu.column_name AS referencing_column,`,
      `    ccu.table_name AS referenced_table`,
      `FROM information_schema.table_constraints tc`,
      `JOIN information_schema.key_column_usage kcu`,
      `    ON tc.constraint_name = kcu.constraint_name`,
      `JOIN information_schema.constraint_column_usage ccu`,
      `    ON ccu.constraint_name = tc.constraint_name`,
      `WHERE tc.constraint_type = 'FOREIGN KEY'`,
      `    AND ccu.table_name = '${tableName}';`,
    );
  } else if (dialect === 'mysql' || dialect === 'mariadb') {
    lines.push(
      `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME`,
      `FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE`,
      `WHERE REFERENCED_TABLE_NAME = '${tableName}';`,
    );
  } else {
    lines.push(`-- Check your database for FK references to ${tableName}`);
  }

  lines.push(
    ``,
    `-- Step 5: Estimate table size impact`,
  );

  if (dialect === 'postgresql') {
    lines.push(
      `SELECT pg_size_pretty(pg_total_relation_size('${tableName}')) AS current_size;`,
    );
  } else {
    lines.push(`-- Check table size using your database's size functions`);
  }

  lines.push(
    ``,
    `-- =====================================================`,
    `-- NOTE: This is a DRY RUN. No data will be deleted.`,
    `-- Review the results above before running in LIVE mode.`,
    `-- =====================================================`,
  );

  return {
    ruleId: '',
    ruleName,
    targetTable: tableName,
    script: lines.join('\n'),
    dryRun: true,
    batchSize,
    dialect,
  };
}

function buildLiveScript(
  ruleName: string,
  tableName: string,
  config: RuleConfiguration,
  whereClause: string,
  batchSize: number,
  dialect: string,
) {
  const lines = [
    `-- =====================================================`,
    `-- LIVE PURGE: "${ruleName}"`,
    `-- =====================================================`,
    `-- Target table: ${tableName}`,
    `-- Retention: ${config.retentionPeriod} ${config.retentionUnit} on column "${config.retentionColumn}"`,
    `-- Batch size: ${batchSize.toLocaleString()}`,
    `-- Dialect: ${dialect}`,
    `-- Generated at: ${new Date().toISOString()}`,
    `-- WARNING: This script WILL permanently delete data!`,
    ``,
  ];

  if (config.backupBeforePurge) {
    lines.push(
      `-- Step 0: Create backup table`,
      `CREATE TABLE ${tableName}_purge_backup_${Date.now()} AS`,
      `SELECT * FROM ${tableName}`,
      `WHERE ${whereClause};`,
      ``,
    );
  }

  lines.push(
    `-- Step 1: Pre-flight count`,
    `SELECT COUNT(*) AS rows_to_purge FROM ${tableName}`,
    `WHERE ${whereClause};`,
    ``,
  );

  // Dialect-specific batch delete
  if (dialect === 'postgresql') {
    lines.push(
      `-- Step 2: Batch delete with progress tracking`,
      `DO $$`,
      `DECLARE`,
      `  total_rows BIGINT;`,
      `  deleted_rows BIGINT := 0;`,
      `  batch_deleted BIGINT;`,
      `  start_time TIMESTAMPTZ := clock_timestamp();`,
      `BEGIN`,
      `  SELECT COUNT(*) INTO total_rows`,
      `  FROM ${tableName}`,
      `  WHERE ${whereClause};`,
      ``,
      `  RAISE NOTICE 'Starting purge of % rows from ${tableName}', total_rows;`,
      ``,
      `  LOOP`,
      `    DELETE FROM ${tableName}`,
      `    WHERE ctid IN (`,
      `      SELECT ctid`,
      `      FROM ${tableName}`,
      `      WHERE ${whereClause}`,
      `      LIMIT ${batchSize}`,
      `    );`,
      ``,
      `    GET DIAGNOSTICS batch_deleted = ROW_COUNT;`,
      `    deleted_rows := deleted_rows + batch_deleted;`,
      ``,
      `    RAISE NOTICE 'Batch: % rows | Total: %/%',`,
      `      batch_deleted, deleted_rows, total_rows;`,
      ``,
      `    EXIT WHEN batch_deleted = 0;`,
      ``,
      `    -- Pause between batches to reduce lock contention`,
      `    PERFORM pg_sleep(0.1);`,
      `  END LOOP;`,
      ``,
      `  RAISE NOTICE 'Purge complete. Deleted % rows in % seconds',`,
      `    deleted_rows, EXTRACT(EPOCH FROM clock_timestamp() - start_time)::INT;`,
      `END $$;`,
    );
  } else if (dialect === 'mysql' || dialect === 'mariadb') {
    lines.push(
      `-- Step 2: Batch delete`,
      `-- Run this block repeatedly until @deleted = 0`,
      `SET @deleted = 1;`,
      `SET @total_deleted = 0;`,
      ``,
      `-- Execute in a loop (use application code or stored procedure)`,
      `DELETE FROM ${tableName}`,
      `WHERE ${whereClause}`,
      `LIMIT ${batchSize};`,
      `-- Check ROW_COUNT() and repeat until 0`,
    );
  } else if (dialect === 'sqlserver') {
    lines.push(
      `-- Step 2: Batch delete`,
      `DECLARE @deleted INT = 1;`,
      `DECLARE @total_deleted INT = 0;`,
      ``,
      `WHILE @deleted > 0`,
      `BEGIN`,
      `  DELETE TOP (${batchSize}) FROM ${tableName}`,
      `  WHERE ${whereClause};`,
      ``,
      `  SET @deleted = @@ROWCOUNT;`,
      `  SET @total_deleted = @total_deleted + @deleted;`,
      `  PRINT CONCAT('Deleted batch: ', @deleted, ' | Total: ', @total_deleted);`,
      ``,
      `  WAITFOR DELAY '00:00:00.100';`,
      `END`,
    );
  } else {
    // SQLite / generic
    lines.push(
      `-- Step 2: Delete eligible rows`,
      `DELETE FROM ${tableName}`,
      `WHERE ${whereClause};`,
    );
  }

  lines.push(
    ``,
    `-- Step 3: Post-purge verification`,
    `SELECT COUNT(*) AS remaining_rows FROM ${tableName};`,
    ``,
    `-- Step 4: Reclaim space (optional, run during maintenance window)`,
  );

  if (dialect === 'postgresql') {
    lines.push(`VACUUM ANALYZE ${tableName};`);
  } else if (dialect === 'mysql' || dialect === 'mariadb') {
    lines.push(`OPTIMIZE TABLE ${tableName};`);
  } else if (dialect === 'sqlite') {
    lines.push(`VACUUM;`);
  } else {
    lines.push(`-- Run your database's table optimization command`);
  }

  return {
    ruleId: '',
    ruleName,
    targetTable: tableName,
    script: lines.join('\n'),
    dryRun: false,
    batchSize,
    dialect,
  };
}

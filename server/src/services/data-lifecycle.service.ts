import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

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

export async function generatePurgeScript(ruleId: string) {
  const rule = await prisma.dataLifecycleRule.findUnique({
    where: { id: ruleId },
  });

  if (!rule) {
    throw new NotFoundError('DataLifecycleRule');
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(rule.configuration);
  } catch {
    config = {};
  }

  const retentionDays = (config.retentionDays as number) ?? 90;
  const dateColumn = (config.dateColumn as string) ?? 'created_at';
  const batchSize = (config.batchSize as number) ?? 1000;
  const conditions = (config.conditions as string) ?? '';

  const tableName = rule.targetTable;
  const whereClause = conditions
    ? `WHERE ${dateColumn} < DATE('now', '-${retentionDays} days') AND ${conditions}`
    : `WHERE ${dateColumn} < DATE('now', '-${retentionDays} days')`;

  const script = [
    `-- Purge script for rule: ${rule.ruleName}`,
    `-- Target table: ${tableName}`,
    `-- Retention: ${retentionDays} days`,
    `-- Generated at: ${new Date().toISOString()}`,
    ``,
    `-- Step 1: Preview rows to be purged`,
    `SELECT COUNT(*) AS rows_to_purge FROM ${tableName}`,
    `${whereClause};`,
    ``,
    `-- Step 2: Delete in batches to avoid long locks`,
    `DELETE FROM ${tableName}`,
    `${whereClause}`,
    `LIMIT ${batchSize};`,
    ``,
    `-- Repeat Step 2 until no rows are deleted.`,
    `-- Consider wrapping in a loop or scheduled job.`,
  ].join('\n');

  return {
    ruleId: rule.id,
    ruleName: rule.ruleName,
    targetTable: tableName,
    retentionDays,
    script,
  };
}

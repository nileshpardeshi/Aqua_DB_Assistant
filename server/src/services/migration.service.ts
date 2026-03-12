import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';
import crypto from 'node:crypto';

// ---------- Create Migration ----------

export async function createMigration(data: {
  projectId: string;
  version: string;
  title: string;
  description?: string;
  upSQL: string;
  downSQL?: string;
  status?: string;
  sourceDialect: string;
  targetDialect: string;
  dependsOn?: string;
}) {
  const checksum = crypto
    .createHash('sha256')
    .update(data.upSQL)
    .digest('hex');

  const migration = await prisma.migration.create({
    data: {
      projectId: data.projectId,
      version: data.version,
      title: data.title,
      description: data.description ?? null,
      upSQL: data.upSQL,
      downSQL: data.downSQL ?? null,
      status: data.status ?? 'draft',
      sourceDialect: data.sourceDialect,
      targetDialect: data.targetDialect,
      checksum,
      dependsOn: data.dependsOn ?? null,
    },
  });

  return migration;
}

// ---------- List Migrations ----------

export async function listMigrations(projectId: string) {
  const migrations = await prisma.migration.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return migrations;
}

// ---------- Get Migration ----------

export async function getMigration(id: string) {
  const migration = await prisma.migration.findUnique({
    where: { id },
  });

  if (!migration) {
    throw new NotFoundError('Migration');
  }

  return migration;
}

// ---------- Update Migration ----------

export async function updateMigration(
  id: string,
  data: {
    title?: string;
    description?: string;
    upSQL?: string;
    downSQL?: string;
    status?: string;
    appliedAt?: Date;
    dependsOn?: string;
  },
) {
  const existing = await prisma.migration.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('Migration');
  }

  // Recalculate checksum if upSQL changed
  const updateData: Record<string, unknown> = { ...data };
  if (data.upSQL) {
    updateData.checksum = crypto
      .createHash('sha256')
      .update(data.upSQL)
      .digest('hex');
  }

  const migration = await prisma.migration.update({
    where: { id },
    data: updateData,
  });

  return migration;
}

// ---------- Delete Migration ----------

export async function deleteMigration(id: string) {
  const existing = await prisma.migration.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('Migration');
  }

  await prisma.migration.delete({ where: { id } });

  return existing;
}

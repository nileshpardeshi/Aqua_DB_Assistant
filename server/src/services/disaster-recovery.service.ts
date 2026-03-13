import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ── List Assessments ────────────────────────────────────────────────

export async function listAssessments(projectId: string) {
  return prisma.dRAssessment.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Get Assessment ──────────────────────────────────────────────────

export async function getAssessment(id: string) {
  const assessment = await prisma.dRAssessment.findUnique({ where: { id } });
  if (!assessment) throw new NotFoundError('DRAssessment');
  return assessment;
}

// ── Create Assessment ───────────────────────────────────────────────

export async function createAssessment(data: {
  projectId: string;
  name: string;
  infrastructure: string;
  backupConfig: string;
  replicationConfig: string;
  compliance: string;
}) {
  return prisma.dRAssessment.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      infrastructure: data.infrastructure,
      backupConfig: data.backupConfig,
      replicationConfig: data.replicationConfig,
      compliance: data.compliance,
      status: 'draft',
    },
  });
}

// ── Update Assessment ───────────────────────────────────────────────

export async function updateAssessment(
  id: string,
  data: {
    name?: string;
    infrastructure?: string;
    backupConfig?: string;
    replicationConfig?: string;
    compliance?: string;
    strategy?: string;
    riskScore?: number;
    status?: string;
  },
) {
  const existing = await prisma.dRAssessment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('DRAssessment');

  return prisma.dRAssessment.update({
    where: { id },
    data,
  });
}

// ── Delete Assessment ───────────────────────────────────────────────

export async function deleteAssessment(id: string) {
  const existing = await prisma.dRAssessment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('DRAssessment');

  return prisma.dRAssessment.delete({ where: { id } });
}

// ── Get Schema Stats (compact, for AI prompt) ───────────────────────

export async function getSchemaStats(projectId: string) {
  const tables = await prisma.tableMetadata.findMany({
    where: { projectId },
    select: { tableName: true, rowCountEstimate: true },
  });

  return {
    tableCount: tables.length,
    totalSizeGB: 0, // User provides this in the form — we don't have real DB access
    largestTableGB: 0,
  };
}

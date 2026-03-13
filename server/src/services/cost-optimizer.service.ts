import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ── List Assessments ────────────────────────────────────────────────

export async function listAssessments(projectId: string) {
  return prisma.costAssessment.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Get Assessment ──────────────────────────────────────────────────

export async function getAssessment(id: string) {
  const assessment = await prisma.costAssessment.findUnique({ where: { id } });
  if (!assessment) throw new NotFoundError('CostAssessment');
  return assessment;
}

// ── Create Assessment ───────────────────────────────────────────────

export async function createAssessment(data: {
  projectId: string;
  name: string;
  cloudConfig: string;
  queryPatterns: string;
  storageProfile: string;
  indexProfile: string;
}) {
  return prisma.costAssessment.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      cloudConfig: data.cloudConfig,
      queryPatterns: data.queryPatterns,
      storageProfile: data.storageProfile,
      indexProfile: data.indexProfile,
      status: 'draft',
    },
  });
}

// ── Update Assessment ───────────────────────────────────────────────

export async function updateAssessment(
  id: string,
  data: {
    name?: string;
    cloudConfig?: string;
    queryPatterns?: string;
    storageProfile?: string;
    indexProfile?: string;
    analysis?: string;
    monthlySavings?: number;
    status?: string;
  },
) {
  const existing = await prisma.costAssessment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('CostAssessment');

  return prisma.costAssessment.update({ where: { id }, data });
}

// ── Delete Assessment ───────────────────────────────────────────────

export async function deleteAssessment(id: string) {
  const existing = await prisma.costAssessment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('CostAssessment');

  return prisma.costAssessment.delete({ where: { id } });
}

import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ---------- Create Performance Run ----------

export async function createPerformanceRun(data: {
  projectId: string;
  runType: string;
  status: string;
  summary?: string;
  findings?: string;
  recommendations?: string;
}) {
  const run = await prisma.performanceRun.create({
    data: {
      projectId: data.projectId,
      runType: data.runType,
      status: data.status,
      summary: data.summary ?? null,
      findings: data.findings ?? null,
      recommendations: data.recommendations ?? null,
    },
  });

  return run;
}

// ---------- List Performance Runs ----------

export async function listPerformanceRuns(projectId: string) {
  const runs = await prisma.performanceRun.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
  });

  return runs;
}

// ---------- Get Performance Run ----------

export async function getPerformanceRun(id: string) {
  const run = await prisma.performanceRun.findUnique({
    where: { id },
  });

  if (!run) {
    throw new NotFoundError('PerformanceRun');
  }

  return run;
}

// ---------- Update Performance Run ----------

export async function updatePerformanceRun(
  id: string,
  data: {
    status?: string;
    summary?: string;
    findings?: string;
    recommendations?: string;
    completedAt?: Date;
  },
) {
  const existing = await prisma.performanceRun.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('PerformanceRun');
  }

  const run = await prisma.performanceRun.update({
    where: { id },
    data,
  });

  return run;
}

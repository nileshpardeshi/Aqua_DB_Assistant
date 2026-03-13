import { prisma } from '../config/prisma.js';
import { getCurrentMonthUsage } from './ai-usage.service.js';

// ---------- Check Budget ----------

export async function checkBudget(
  projectId?: string,
): Promise<{
  allowed: boolean;
  percentUsed: number;
  warning: boolean;
  limit: number;
  used: number;
}> {
  // Try project-specific budget first, then fall back to global (projectId = null)
  let config = projectId
    ? await prisma.aIBudgetConfig.findFirst({
        where: { projectId, isActive: true },
      })
    : null;

  if (!config) {
    config = await prisma.aIBudgetConfig.findFirst({
      where: { projectId: null, isActive: true },
    });
  }

  // No budget configured — allow everything
  if (!config) {
    return { allowed: true, percentUsed: 0, warning: false, limit: 0, used: 0 };
  }

  const usage = await getCurrentMonthUsage(projectId);
  const limit = Number(config.monthlyTokenLimit);
  const used = usage.totalTokens;
  const percentUsed = limit > 0 ? (used / limit) * 100 : 0;
  const warning = percentUsed >= config.warningThreshold * 100;
  const allowed = config.isHardLimit ? used < limit : true;

  return { allowed, percentUsed, warning, limit, used };
}

// ---------- Get Budget Config ----------

export async function getBudgetConfig(projectId?: string) {
  return prisma.aIBudgetConfig.findFirst({
    where: { projectId: projectId ?? null },
  });
}

// ---------- List Budget Configs ----------

export async function listBudgetConfigs() {
  return prisma.aIBudgetConfig.findMany({
    include: { project: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------- Upsert Budget Config ----------

export async function upsertBudgetConfig(data: {
  projectId?: string;
  monthlyTokenLimit: number;
  warningThreshold?: number;
  isHardLimit?: boolean;
  isActive?: boolean;
}) {
  const projectId = data.projectId ?? null;

  // Find existing config for this project (or global)
  const existing = await prisma.aIBudgetConfig.findFirst({
    where: { projectId },
  });

  if (existing) {
    return prisma.aIBudgetConfig.update({
      where: { id: existing.id },
      data: {
        monthlyTokenLimit: BigInt(data.monthlyTokenLimit),
        warningThreshold: data.warningThreshold ?? existing.warningThreshold,
        isHardLimit: data.isHardLimit ?? existing.isHardLimit,
        isActive: data.isActive ?? existing.isActive,
      },
    });
  }

  return prisma.aIBudgetConfig.create({
    data: {
      projectId,
      monthlyTokenLimit: BigInt(data.monthlyTokenLimit),
      warningThreshold: data.warningThreshold ?? 0.8,
      isHardLimit: data.isHardLimit ?? false,
      isActive: data.isActive ?? true,
    },
  });
}

// ---------- Delete Budget Config ----------

export async function deleteBudgetConfig(id: string) {
  return prisma.aIBudgetConfig.delete({
    where: { id },
  });
}

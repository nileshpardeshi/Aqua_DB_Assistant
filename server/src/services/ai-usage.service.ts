import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';

// ---------- Model Pricing Map (USD per 1M tokens) ----------

const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'claude-sonnet-4-20250514': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-opus-4-20250514': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-haiku-3.5': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },
  'gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5 },
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.0 },
  'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'gemini-2.0-flash-lite': { inputPer1M: 0.0, outputPer1M: 0.0 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.0 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.3 },
};

const DEFAULT_PRICING = { inputPer1M: 1.0, outputPer1M: 3.0 };

// ---------- Cost Estimation ----------

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal places
}

// ---------- Log AI Usage ----------

export async function logAIUsage(data: {
  projectId?: string;
  module: string;
  endpoint: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    const totalTokens = data.inputTokens + data.outputTokens;
    const cost = estimateCost(data.model, data.inputTokens, data.outputTokens);

    await prisma.aIUsageLog.create({
      data: {
        projectId: data.projectId ?? null,
        module: data.module,
        endpoint: data.endpoint,
        provider: data.provider,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens,
        estimatedCost: cost,
        durationMs: data.durationMs,
        status: data.status,
        errorMessage: data.errorMessage ?? null,
      },
    });
  } catch (err) {
    logger.warn('Failed to log AI usage', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------- Filter Builder ----------

interface UsageFilters {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  module?: string;
  provider?: string;
}

function buildWhere(filters: UsageFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (filters.projectId) {
    where.projectId = filters.projectId;
  }

  if (filters.module) {
    where.module = filters.module;
  }

  if (filters.provider) {
    where.provider = filters.provider;
  }

  if (filters.startDate || filters.endDate) {
    const createdAt: Record<string, Date> = {};
    if (filters.startDate) {
      createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      createdAt.lte = new Date(filters.endDate);
    }
    where.createdAt = createdAt;
  }

  return where;
}

// ---------- Usage Summary ----------

export async function getUsageSummary(filters: UsageFilters = {}) {
  const where = buildWhere(filters);

  const result = await prisma.aIUsageLog.aggregate({
    where,
    _sum: {
      totalTokens: true,
      estimatedCost: true,
    },
    _count: {
      id: true,
    },
    _avg: {
      totalTokens: true,
    },
  });

  return {
    totalTokens: result._sum.totalTokens ?? 0,
    totalCost: result._sum.estimatedCost ?? 0,
    totalCalls: result._count.id,
    avgTokensPerCall: Math.round(result._avg.totalTokens ?? 0),
  };
}

// ---------- Usage By Module ----------

export async function getUsageByModule(filters: UsageFilters = {}) {
  const where = buildWhere(filters);

  const groups = await prisma.aIUsageLog.groupBy({
    by: ['module'],
    where,
    _sum: {
      totalTokens: true,
      estimatedCost: true,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _sum: { totalTokens: 'desc' },
    },
  });

  return groups.map((g) => ({
    module: g.module,
    totalTokens: g._sum.totalTokens ?? 0,
    totalCost: g._sum.estimatedCost ?? 0,
    totalCalls: g._count.id,
  }));
}

// ---------- Usage By Provider ----------

export async function getUsageByProvider(filters: UsageFilters = {}) {
  const where = buildWhere(filters);

  const groups = await prisma.aIUsageLog.groupBy({
    by: ['provider', 'model'],
    where,
    _sum: {
      totalTokens: true,
      estimatedCost: true,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _sum: { totalTokens: 'desc' },
    },
  });

  return groups.map((g) => ({
    provider: g.provider,
    model: g.model,
    totalTokens: g._sum.totalTokens ?? 0,
    totalCost: g._sum.estimatedCost ?? 0,
    totalCalls: g._count.id,
  }));
}

// ---------- Usage By Project ----------

export async function getUsageByProject(filters: UsageFilters = {}) {
  const where = buildWhere(filters);

  const groups = await prisma.aIUsageLog.groupBy({
    by: ['projectId'],
    where,
    _sum: {
      totalTokens: true,
      estimatedCost: true,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _sum: { totalTokens: 'desc' },
    },
  });

  // Fetch project names for each group
  const projectIds = groups
    .map((g) => g.projectId)
    .filter((id): id is string => id !== null);

  const projects =
    projectIds.length > 0
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : [];

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  return groups.map((g) => ({
    projectId: g.projectId,
    projectName: g.projectId ? projectMap.get(g.projectId) ?? 'Unknown' : 'Global',
    totalTokens: g._sum.totalTokens ?? 0,
    totalCost: g._sum.estimatedCost ?? 0,
    totalCalls: g._count.id,
  }));
}

// ---------- Top Calls ----------

export async function getTopCalls(filters: UsageFilters = {}, limit = 10) {
  const where = buildWhere(filters);

  return prisma.aIUsageLog.findMany({
    where,
    orderBy: { totalTokens: 'desc' },
    take: limit,
  });
}

// ---------- Usage Trend ----------

export async function getUsageTrend(filters: UsageFilters = {}, days = 30) {
  const where = buildWhere(filters);

  // If no startDate filter, default to last N days
  if (!filters.startDate) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    (where as any).createdAt = {
      ...((where as any).createdAt ?? {}),
      gte: start,
    };
  }

  const logs = await prisma.aIUsageLog.findMany({
    where,
    select: {
      createdAt: true,
      totalTokens: true,
      estimatedCost: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Aggregate by date
  const dailyMap = new Map<string, { tokens: number; cost: number; calls: number }>();

  for (const log of logs) {
    const dateKey = log.createdAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(dateKey) ?? { tokens: 0, cost: 0, calls: 0 };
    entry.tokens += log.totalTokens;
    entry.cost += log.estimatedCost;
    entry.calls += 1;
    dailyMap.set(dateKey, entry);
  }

  return Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    totalTokens: data.tokens,
    totalCost: Math.round(data.cost * 1_000_000) / 1_000_000,
    totalCalls: data.calls,
  }));
}

// ---------- Current Month Usage ----------

export async function getCurrentMonthUsage(projectId?: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const where: Record<string, unknown> = {
    createdAt: { gte: startOfMonth },
  };

  if (projectId) {
    where.projectId = projectId;
  }

  const result = await prisma.aIUsageLog.aggregate({
    where,
    _sum: {
      totalTokens: true,
      estimatedCost: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    totalTokens: result._sum.totalTokens ?? 0,
    totalCost: result._sum.estimatedCost ?? 0,
    totalCalls: result._count.id,
  };
}

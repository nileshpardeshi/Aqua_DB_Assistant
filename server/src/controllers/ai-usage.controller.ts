import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import {
  getUsageSummary,
  getUsageByModule,
  getUsageByProvider,
  getUsageByProject,
  getTopCalls,
  getUsageTrend,
  getCurrentMonthUsage,
} from '../services/ai-usage.service.js';
import {
  getBudgetConfig,
  listBudgetConfigs,
  upsertBudgetConfig,
  deleteBudgetConfig,
  checkBudget,
} from '../services/ai-budget.service.js';

// ---------- Helpers ----------

function parseFilters(query: Record<string, unknown>) {
  return {
    startDate: typeof query.startDate === 'string' ? query.startDate : undefined,
    endDate: typeof query.endDate === 'string' ? query.endDate : undefined,
    projectId: typeof query.projectId === 'string' ? query.projectId : undefined,
    module: typeof query.module === 'string' ? query.module : undefined,
    provider: typeof query.provider === 'string' ? query.provider : undefined,
  };
}

// ---------- Usage Summary ----------

export const summary = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseFilters(req.query);
  const data = await getUsageSummary(filters);
  res.json({ success: true, data });
});

// ---------- By Module ----------

export const byModule = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseFilters(req.query);
  const data = await getUsageByModule(filters);
  res.json({ success: true, data });
});

// ---------- By Provider ----------

export const byProvider = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseFilters(req.query);
  const data = await getUsageByProvider(filters);
  res.json({ success: true, data });
});

// ---------- By Project ----------

export const byProject = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseFilters(req.query);
  const data = await getUsageByProject(filters);
  res.json({ success: true, data });
});

// ---------- Top Calls ----------

export const topCalls = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseFilters(req.query);
  const limit = parseInt(req.query.limit as string) || 10;
  const data = await getTopCalls(filters, limit);
  res.json({ success: true, data });
});

// ---------- Trend ----------

export const trend = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseFilters(req.query);
  const days = parseInt(req.query.days as string) || 30;
  const data = await getUsageTrend(filters, days);
  res.json({ success: true, data });
});

// ---------- Current Month ----------

export const currentMonth = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const usage = await getCurrentMonthUsage(projectId);
  const budget = await checkBudget(projectId);
  res.json({ success: true, data: { ...usage, budget } });
});

// ---------- Budget: List ----------

export const getBudget = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listBudgetConfigs();
  res.json({ success: true, data });
});

// ---------- Budget: Upsert ----------

export const updateBudget = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, monthlyTokenLimit, warningThreshold, isHardLimit, isActive } = req.body;

  if (!monthlyTokenLimit || monthlyTokenLimit <= 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'monthlyTokenLimit is required and must be positive',
      },
    });
    return;
  }

  const data = await upsertBudgetConfig({
    projectId: projectId || null,
    monthlyTokenLimit,
    warningThreshold,
    isHardLimit,
    isActive,
  });
  res.json({ success: true, data });
});

// ---------- Budget: Delete ----------

export const removeBudget = asyncHandler(async (req: Request, res: Response) => {
  await deleteBudgetConfig(req.params.id as string);
  res.json({ success: true, data: { deleted: true } });
});

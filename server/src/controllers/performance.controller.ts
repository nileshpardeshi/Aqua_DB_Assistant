import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as performanceService from '../services/performance.service.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const runs = await performanceService.listPerformanceRuns(projectId);

  res.json({
    success: true,
    data: runs,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const runId = req.params.runId as string;
  const run = await performanceService.getPerformanceRun(runId);

  res.json({
    success: true,
    data: run,
  });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { runType, type, status, name, config, summary, findings, recommendations } = req.body;

  const run = await performanceService.createPerformanceRun({
    projectId,
    runType: runType || type || 'benchmark',
    status: status || 'completed',
    summary: summary || name || null,
    findings: findings || (config ? JSON.stringify(config) : null),
    recommendations,
  });

  res.status(201).json({
    success: true,
    data: run,
  });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const runId = req.params.runId as string;
  const { status, summary, findings, recommendations, completedAt } = req.body;

  const run = await performanceService.updatePerformanceRun(runId, {
    status,
    summary,
    findings,
    recommendations,
    completedAt: completedAt ? new Date(completedAt) : undefined,
  });

  res.json({
    success: true,
    data: run,
  });
});

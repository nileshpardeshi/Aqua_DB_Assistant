import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as auditService from '../services/audit.service.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, action, entity, startDate, endDate, page, limit } =
    req.query as Record<string, string | undefined>;

  const result = await auditService.listLogs(projectId, {
    action,
    entity,
    startDate,
    endDate,
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });

  res.json({
    success: true,
    ...result,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const logId = req.params.logId as string;
  const log = await auditService.getLog(logId);

  res.json({
    success: true,
    data: log,
  });
});

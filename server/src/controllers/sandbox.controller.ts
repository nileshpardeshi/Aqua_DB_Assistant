import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as sandboxService from '../services/sandbox.service.js';

// ---------- Execute SQL in Sandbox ----------

export const execute = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { sql, tableNames, tableColumns } = req.body;

  const result = await sandboxService.executeSandbox({
    projectId,
    sql,
    tableNames: tableNames || [],
    tableColumns: tableColumns || [],
  });

  res.status(201).json({ success: true, data: result });
});

// ---------- Query Sandbox Table Data ----------

export const queryTable = asyncHandler(async (req: Request, res: Response) => {
  const tableName = req.params.tableName as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

  const result = await sandboxService.querySandboxTable({
    tableName,
    page,
    limit,
  });

  res.json({ success: true, data: result });
});

// ---------- Get Sandbox Status ----------

export const status = asyncHandler(async (_req: Request, res: Response) => {
  const result = await sandboxService.getSandboxStatus();
  res.json({ success: true, data: result });
});

// ---------- Cleanup Sandbox ----------

export const cleanup = asyncHandler(async (_req: Request, res: Response) => {
  const result = await sandboxService.cleanupSandbox();
  res.json({ success: true, data: result });
});

// ---------- Promote Sandbox to Real Tables ----------

export const promote = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { tableNames } = req.body;

  const result = await sandboxService.promoteSandbox({
    projectId,
    tableNames: tableNames || [],
  });

  res.json({ success: true, data: result });
});

// ---------- Cleanup Promoted (Real) Tables ----------

export const cleanupPromoted = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { tableNames } = req.body;

  const result = await sandboxService.cleanupPromotedTables({
    projectId,
    tableNames: tableNames || [],
  });

  res.json({ success: true, data: result });
});

import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as dataLifecycleService from '../services/data-lifecycle.service.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const rules = await dataLifecycleService.listRules(projectId);

  res.json({
    success: true,
    data: rules,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const ruleId = req.params.ruleId as string;
  const rule = await dataLifecycleService.getRule(ruleId);

  res.json({
    success: true,
    data: rule,
  });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { ruleName, ruleType, targetTable, targetColumns, configuration, isActive } =
    req.body;

  const rule = await dataLifecycleService.createRule({
    projectId,
    ruleName,
    ruleType,
    targetTable,
    targetColumns,
    configuration,
    isActive,
  });

  res.status(201).json({
    success: true,
    data: rule,
  });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const ruleId = req.params.ruleId as string;
  const { ruleName, ruleType, targetTable, targetColumns, configuration, isActive } =
    req.body;

  const rule = await dataLifecycleService.updateRule(ruleId, {
    ruleName,
    ruleType,
    targetTable,
    targetColumns,
    configuration,
    isActive,
  });

  res.json({
    success: true,
    data: rule,
  });
});

// ---------- Delete ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const ruleId = req.params.ruleId as string;
  const rule = await dataLifecycleService.deleteRule(ruleId);

  res.json({
    success: true,
    data: rule,
  });
});

// ---------- Generate Purge Script ----------

export const generatePurgeScript = asyncHandler(
  async (req: Request, res: Response) => {
    const ruleId = req.params.ruleId as string;
    const { batchSize, dryRun, dialect } = req.body;

    const result = await dataLifecycleService.generatePurgeScript(ruleId, {
      batchSize,
      dryRun,
      dialect,
    });

    res.json({
      success: true,
      data: result,
    });
  },
);

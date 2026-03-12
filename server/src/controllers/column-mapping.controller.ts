import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as columnMappingService from '../services/column-mapping.service.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const mappings = await columnMappingService.listColumnMappings(projectId);

  res.json({
    success: true,
    data: mappings,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const mappingId = req.params.mappingId as string;
  const mapping = await columnMappingService.getColumnMapping(mappingId);

  res.json({
    success: true,
    data: mapping,
  });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const {
    name,
    sourceTableName,
    targetTableName,
    sourceDialect,
    targetDialect,
    mappings,
  } = req.body;

  const mapping = await columnMappingService.createColumnMapping({
    projectId,
    name,
    sourceTableName,
    targetTableName,
    sourceDialect,
    targetDialect,
    mappings: typeof mappings === 'string' ? mappings : JSON.stringify(mappings),
  });

  res.status(201).json({
    success: true,
    data: mapping,
  });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const mappingId = req.params.mappingId as string;
  const { name, sourceTableName, targetTableName, sourceDialect, targetDialect, mappings } =
    req.body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (sourceTableName !== undefined) updateData.sourceTableName = sourceTableName;
  if (targetTableName !== undefined) updateData.targetTableName = targetTableName;
  if (sourceDialect !== undefined) updateData.sourceDialect = sourceDialect;
  if (targetDialect !== undefined) updateData.targetDialect = targetDialect;
  if (mappings !== undefined) {
    updateData.mappings = typeof mappings === 'string' ? mappings : JSON.stringify(mappings);
  }

  const mapping = await columnMappingService.updateColumnMapping(mappingId, updateData);

  res.json({
    success: true,
    data: mapping,
  });
});

// ---------- Delete ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const mappingId = req.params.mappingId as string;
  const mapping = await columnMappingService.deleteColumnMapping(mappingId);

  res.json({
    success: true,
    data: mapping,
  });
});

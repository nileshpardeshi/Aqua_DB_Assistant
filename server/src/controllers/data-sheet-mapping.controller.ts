import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as dataSheetMappingService from '../services/data-sheet-mapping.service.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const mappings = await dataSheetMappingService.listDataSheetMappings(projectId);

  res.json({
    success: true,
    data: mappings,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const mappingId = req.params.mappingId as string;
  const mapping = await dataSheetMappingService.getDataSheetMapping(mappingId);

  res.json({
    success: true,
    data: mapping,
  });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { name, sourceTableName, csvFileName, mappings } = req.body;

  const mapping = await dataSheetMappingService.createDataSheetMapping({
    projectId,
    name,
    sourceTableName,
    csvFileName,
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
  const { name, sourceTableName, csvFileName, mappings } = req.body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (sourceTableName !== undefined) updateData.sourceTableName = sourceTableName;
  if (csvFileName !== undefined) updateData.csvFileName = csvFileName;
  if (mappings !== undefined) {
    updateData.mappings = typeof mappings === 'string' ? mappings : JSON.stringify(mappings);
  }

  const mapping = await dataSheetMappingService.updateDataSheetMapping(mappingId, updateData);

  res.json({
    success: true,
    data: mapping,
  });
});

// ---------- Delete ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const mappingId = req.params.mappingId as string;
  const mapping = await dataSheetMappingService.deleteDataSheetMapping(mappingId);

  res.json({
    success: true,
    data: mapping,
  });
});

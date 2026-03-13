import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as savedDiagramService from '../services/saved-diagram.service.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const diagrams = await savedDiagramService.listSavedDiagrams(projectId);
  res.json({ success: true, data: diagrams });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const diagram = await savedDiagramService.getSavedDiagram(req.params.diagramId as string);
  res.json({ success: true, data: diagram });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const {
    name, description, diagramType, includedTables, nodePositions,
    layoutDirection, showColumns, showLabels, colorBySchema, annotations, isDefault,
  } = req.body;

  const diagram = await savedDiagramService.createSavedDiagram({
    projectId,
    name,
    description,
    diagramType: diagramType || 'er-full',
    includedTables: typeof includedTables === 'string' ? includedTables : JSON.stringify(includedTables),
    nodePositions: typeof nodePositions === 'string' ? nodePositions : JSON.stringify(nodePositions),
    layoutDirection,
    showColumns,
    showLabels,
    colorBySchema,
    annotations: typeof annotations === 'string' ? annotations : JSON.stringify(annotations),
    isDefault,
  });

  res.status(201).json({ success: true, data: diagram });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const diagramId = req.params.diagramId as string;
  const {
    name, description, diagramType, includedTables, nodePositions,
    layoutDirection, showColumns, showLabels, colorBySchema, annotations, isDefault,
  } = req.body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (diagramType !== undefined) updateData.diagramType = diagramType;
  if (includedTables !== undefined) {
    updateData.includedTables = typeof includedTables === 'string' ? includedTables : JSON.stringify(includedTables);
  }
  if (nodePositions !== undefined) {
    updateData.nodePositions = typeof nodePositions === 'string' ? nodePositions : JSON.stringify(nodePositions);
  }
  if (layoutDirection !== undefined) updateData.layoutDirection = layoutDirection;
  if (showColumns !== undefined) updateData.showColumns = showColumns;
  if (showLabels !== undefined) updateData.showLabels = showLabels;
  if (colorBySchema !== undefined) updateData.colorBySchema = colorBySchema;
  if (annotations !== undefined) {
    updateData.annotations = typeof annotations === 'string' ? annotations : JSON.stringify(annotations);
  }
  if (isDefault !== undefined) updateData.isDefault = isDefault;

  const diagram = await savedDiagramService.updateSavedDiagram(diagramId, updateData);
  res.json({ success: true, data: diagram });
});

// ---------- Delete ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const diagram = await savedDiagramService.deleteSavedDiagram(req.params.diagramId as string);
  res.json({ success: true, data: diagram });
});

// ---------- Duplicate ----------

export const duplicate = asyncHandler(async (req: Request, res: Response) => {
  const diagram = await savedDiagramService.duplicateSavedDiagram(req.params.diagramId as string);
  res.status(201).json({ success: true, data: diagram });
});

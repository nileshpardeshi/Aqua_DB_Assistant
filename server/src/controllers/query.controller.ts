import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as queryService from '../services/query.service.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { search, category, isFavorite } = req.query as Record<string, string | undefined>;

  const queries = await queryService.listQueries(projectId, {
    search,
    category,
    isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
  });

  res.json({
    success: true,
    data: queries,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const queryId = req.params.queryId as string;
  const query = await queryService.getQueryById(queryId);

  res.json({
    success: true,
    data: query,
  });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const { title, description, sql, dialect, category, isFavorite, tags } = req.body;

  const query = await queryService.createQuery({
    projectId,
    title,
    description,
    sql,
    dialect,
    category,
    isFavorite,
    tags,
  });

  res.status(201).json({
    success: true,
    data: query,
  });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const queryId = req.params.queryId as string;
  const { title, description, sql, dialect, category, isFavorite, tags } = req.body;

  const query = await queryService.updateQuery(queryId, {
    title,
    description,
    sql,
    dialect,
    category,
    isFavorite,
    tags,
  });

  res.json({
    success: true,
    data: query,
  });
});

// ---------- Delete ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const queryId = req.params.queryId as string;
  const query = await queryService.deleteQuery(queryId);

  res.json({
    success: true,
    data: query,
  });
});

// ---------- Execute (record execution) ----------

export const execute = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const {
    savedQueryId,
    sql,
    dialect,
    status,
    rowsAffected,
    rowsReturned,
    executionTime,
    resultPreview,
    explainPlan,
    errorMessage,
  } = req.body;

  const execution = await queryService.createExecution({
    projectId,
    savedQueryId,
    sql,
    dialect,
    status,
    rowsAffected,
    rowsReturned,
    executionTime,
    resultPreview,
    explainPlan,
    errorMessage,
  });

  res.status(201).json({
    success: true,
    data: execution,
  });
});

// ---------- History ----------

export const history = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  const executions = await queryService.getQueryHistory(projectId, limit);

  res.json({
    success: true,
    data: executions,
  });
});

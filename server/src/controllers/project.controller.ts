import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as projectService from '../services/project.service.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectIdParam,
  ProjectListQuery,
} from '../validators/project.validator.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ProjectListQuery;
  const result = await projectService.listProjects(query);

  res.json({
    success: true,
    ...result,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params as unknown as ProjectIdParam;
  const project = await projectService.getProjectById(projectId);

  res.json({
    success: true,
    data: project,
  });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateProjectInput;
  const project = await projectService.createProject(data);

  res.status(201).json({
    success: true,
    data: project,
  });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params as unknown as ProjectIdParam;
  const data = req.body as UpdateProjectInput;
  const project = await projectService.updateProject(projectId, data);

  res.json({
    success: true,
    data: project,
  });
});

// ---------- Remove ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params as unknown as ProjectIdParam;
  const project = await projectService.removeProject(projectId);

  res.json({
    success: true,
    data: project,
  });
});

// ---------- Stats ----------

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params as unknown as ProjectIdParam;
  const stats = await projectService.getProjectStats(projectId);

  res.json({
    success: true,
    data: stats,
  });
});

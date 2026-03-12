import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as connectionService from '../services/connection.service.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const connections = await connectionService.listConnections(projectId);

  res.json({
    success: true,
    data: connections,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const connectionId = req.params.connectionId as string;
  const connection = await connectionService.getConnection(connectionId);

  res.json({
    success: true,
    data: connection,
  });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const {
    name,
    dialect,
    host,
    port,
    database,
    username,
    password,
    sslEnabled,
    sslConfig,
  } = req.body;

  const connection = await connectionService.createConnection({
    projectId,
    name,
    dialect,
    host,
    port,
    database,
    username,
    password,
    sslEnabled,
    sslConfig,
  });

  res.status(201).json({
    success: true,
    data: connection,
  });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const connectionId = req.params.connectionId as string;
  const {
    name,
    dialect,
    host,
    port,
    database,
    username,
    password,
    sslEnabled,
    sslConfig,
    isActive,
  } = req.body;

  const connection = await connectionService.updateConnection(connectionId, {
    name,
    dialect,
    host,
    port,
    database,
    username,
    password,
    sslEnabled,
    sslConfig,
    isActive,
  });

  res.json({
    success: true,
    data: connection,
  });
});

// ---------- Delete ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const connectionId = req.params.connectionId as string;
  const connection = await connectionService.deleteConnection(connectionId);

  res.json({
    success: true,
    data: connection,
  });
});

// ---------- Test Connection ----------

export const test = asyncHandler(async (req: Request, res: Response) => {
  const connectionId = req.params.connectionId as string;
  const result = await connectionService.testConnection(connectionId);

  res.json({
    success: true,
    data: result,
  });
});

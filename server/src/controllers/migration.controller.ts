import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import * as migrationService from '../services/migration.service.js';
import { convertDialect } from '../services/dialect-converter.service.js';

// ---------- List ----------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const migrations = await migrationService.listMigrations(projectId);

  res.json({
    success: true,
    data: migrations,
  });
});

// ---------- Get by ID ----------

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const migrationId = req.params.migrationId as string;
  const migration = await migrationService.getMigration(migrationId);

  res.json({
    success: true,
    data: migration,
  });
});

// ---------- Create ----------

export const create = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const {
    version,
    title,
    description,
    upSQL,
    downSQL,
    status,
    sourceDialect,
    targetDialect,
    dependsOn,
  } = req.body;

  const migration = await migrationService.createMigration({
    projectId,
    version,
    title,
    description,
    upSQL,
    downSQL,
    status,
    sourceDialect,
    targetDialect,
    dependsOn,
  });

  res.status(201).json({
    success: true,
    data: migration,
  });
});

// ---------- Update ----------

export const update = asyncHandler(async (req: Request, res: Response) => {
  const migrationId = req.params.migrationId as string;
  const { title, description, upSQL, downSQL, status, appliedAt, dependsOn } =
    req.body;

  const migration = await migrationService.updateMigration(migrationId, {
    title,
    description,
    upSQL,
    downSQL,
    status,
    appliedAt: appliedAt ? new Date(appliedAt) : undefined,
    dependsOn,
  });

  res.json({
    success: true,
    data: migration,
  });
});

// ---------- Delete ----------

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const migrationId = req.params.migrationId as string;
  const migration = await migrationService.deleteMigration(migrationId);

  res.json({
    success: true,
    data: migration,
  });
});

// ---------- Convert Dialect ----------

export const convert = asyncHandler(async (req: Request, res: Response) => {
  const { sql, sourceDialect, targetDialect } = req.body;

  const result = convertDialect(sql, sourceDialect, targetDialect);

  res.json({
    success: true,
    data: result,
  });
});

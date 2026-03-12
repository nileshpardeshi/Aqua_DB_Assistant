// ---------------------------------------------------------------------------
// Schema Controller – Express handlers for Schema Intelligence API
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import {
  BadRequestError,
  NotFoundError,
} from '../middleware/error-handler.js';
import { prisma } from '../config/prisma.js';
import { sqlParserService } from '../services/sql-parser/index.js';
import * as schemaService from '../services/schema.service.js';
import type { TableFilter } from '../services/schema.service.js';

// ---------------------------------------------------------------------------
// List tables
// GET /api/v1/projects/:projectId/schema/tables
// ---------------------------------------------------------------------------

export const listTables = asyncHandler(async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  const filters: TableFilter = {
    search: req.query.search as string | undefined,
    schemaName: req.query.schemaName as string | undefined,
    tableType: req.query.tableType as string | undefined,
  };

  const tables = await schemaService.getTables(projectId, filters);

  res.json({
    success: true,
    data: tables,
  });
});

// ---------------------------------------------------------------------------
// Get single table
// GET /api/v1/projects/:projectId/schema/tables/:tableId
// ---------------------------------------------------------------------------

export const getTable = asyncHandler(async (req: Request, res: Response) => {
  const tableId = req.params.tableId as string;

  const table = await schemaService.getTableById(tableId);

  res.json({
    success: true,
    data: table,
  });
});

// ---------------------------------------------------------------------------
// Get relationships
// GET /api/v1/projects/:projectId/schema/relationships
// ---------------------------------------------------------------------------

export const getRelationships = asyncHandler(
  async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;

    const relationships = await schemaService.getRelationships(projectId);

    res.json({
      success: true,
      data: relationships,
    });
  },
);

// ---------------------------------------------------------------------------
// Get ER diagram data (React Flow nodes & edges)
// GET /api/v1/projects/:projectId/schema/er-diagram
// ---------------------------------------------------------------------------

export const getERDiagram = asyncHandler(
  async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;

    const filters: TableFilter = {
      search: req.query.search as string | undefined,
      schemaName: req.query.schemaName as string | undefined,
      tableType: req.query.tableType as string | undefined,
    };

    const erData = await schemaService.getERDiagramData(projectId, filters);

    res.json({
      success: true,
      data: erData,
    });
  },
);

// ---------------------------------------------------------------------------
// Parse an uploaded file
// POST /api/v1/projects/:projectId/schema/parse
// Body: { fileId: string }
// ---------------------------------------------------------------------------

export const parseUploadedFile = asyncHandler(
  async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { fileId } = req.body as { fileId?: string };

    if (!fileId) {
      throw new BadRequestError('fileId is required in the request body');
    }

    // Verify the file exists and belongs to this project
    const file = await prisma.projectFile.findFirst({
      where: { id: fileId, projectId },
    });

    if (!file) {
      throw new NotFoundError('File');
    }

    // Read the file content
    if (!fs.existsSync(file.filePath)) {
      throw new BadRequestError(
        `File not found on disk: ${file.fileName}`,
      );
    }

    const sqlContent = fs.readFileSync(file.filePath, 'utf-8');

    if (!sqlContent.trim()) {
      throw new BadRequestError('File is empty');
    }

    // Update parse status to "processing"
    await prisma.fileParseResult.upsert({
      where: { fileId },
      update: { status: 'processing' },
      create: { fileId, status: 'processing' },
    });

    // Run the parser
    const parseResult = sqlParserService.parseSQL(sqlContent, file.dialect ?? undefined);

    // Persist results
    const persistResult = await schemaService.persistParseResult(
      projectId,
      fileId,
      parseResult,
    );

    res.json({
      success: true,
      data: {
        dialect: parseResult.dialect,
        statistics: parseResult.statistics,
        tablesFound: parseResult.tables.length,
        relationshipsFound: parseResult.relationships.length,
        errorsCount: parseResult.errors.length,
        errors: parseResult.errors,
        persisted: persistResult,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// List snapshots
// GET /api/v1/projects/:projectId/schema/snapshots
// ---------------------------------------------------------------------------

export const listSnapshots = asyncHandler(
  async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;

    const snapshots = await schemaService.getSchemaSnapshots(projectId);

    res.json({
      success: true,
      data: snapshots,
    });
  },
);

// ---------------------------------------------------------------------------
// Create snapshot
// POST /api/v1/projects/:projectId/schema/snapshots
// Body: { label?: string }
// ---------------------------------------------------------------------------

export const createSnapshot = asyncHandler(
  async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const { label } = req.body as { label?: string };

    const snapshot = await schemaService.createSchemaSnapshot(
      projectId,
      label,
    );

    res.status(201).json({
      success: true,
      data: snapshot,
    });
  },
);

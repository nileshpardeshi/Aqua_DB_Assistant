import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { asyncHandler } from '../utils/async-handler.js';
import { analyzeCSV } from '../services/csv-parser.service.js';
import { resolveTableOrder } from '../services/dependency-resolver.service.js';
import {
  generateMigrationScript,
  progressMap,
} from '../services/data-migration-script.service.js';
import type { ScriptGenerationConfig } from '../services/data-migration-script.service.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';

// ── CSV Upload Directory ─────────────────────────────────────────────────────

function ensureCSVDir(): string {
  const dir = path.resolve(env.UPLOAD_DIR, 'csv');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ── Multer for CSV uploads (500MB limit) ─────────────────────────────────────

const csvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureCSVDir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const csvUpload = multer({
  storage: csvStorage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.csv', '.tsv', '.txt'].includes(ext)) {
      cb(new BadRequestError(`Only CSV/TSV/TXT files are allowed, got '${ext}'`));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

// ── Upload CSV ───────────────────────────────────────────────────────────────

export const uploadCSV = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new BadRequestError('No CSV file uploaded');
  }

  const analysis = await analyzeCSV(req.file.path);

  res.status(201).json({
    success: true,
    data: {
      filePath: req.file.path,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      ...analysis,
    },
  });
});

// ── Analyze existing CSV ─────────────────────────────────────────────────────

export const analyzeCSVFile = asyncHandler(
  async (req: Request, res: Response) => {
    const { filePath } = req.body;

    if (!filePath || typeof filePath !== 'string') {
      throw new BadRequestError('filePath is required');
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('CSV file');
    }

    const analysis = await analyzeCSV(filePath);

    res.json({
      success: true,
      data: analysis,
    });
  },
);

// ── Resolve Dependencies ─────────────────────────────────────────────────────

export const resolveDependencies = asyncHandler(
  async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const resolution = await resolveTableOrder(projectId);

    res.json({
      success: true,
      data: resolution,
    });
  },
);

// ── Generate Script (async, returns jobId) ───────────────────────────────────

export const generateScript = asyncHandler(
  async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const config = req.body as ScriptGenerationConfig;

    if (!config.tables || config.tables.length === 0) {
      throw new BadRequestError('At least one table configuration is required');
    }

    config.projectId = projectId;
    config.batchSize = config.batchSize || 5000;
    config.disableFKConstraints = config.disableFKConstraints ?? true;
    config.includeTransaction = config.includeTransaction ?? true;

    const jobId = crypto.randomUUID();

    // Start generation in background (don't await)
    generateMigrationScript(config, jobId).catch((err) => {
      logger.error(`Migration script generation failed for job ${jobId}: ${err.message}`);
    });

    res.status(202).json({
      success: true,
      data: { jobId },
    });
  },
);

// ── Get Generation Status ────────────────────────────────────────────────────

export const getGenerationStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const jobId = req.params.jobId as string;
    const progress = progressMap.get(jobId);

    if (!progress) {
      throw new NotFoundError('Generation job');
    }

    res.json({
      success: true,
      data: progress,
    });
  },
);

// ── Download Generated Script ────────────────────────────────────────────────

export const downloadScript = asyncHandler(
  async (req: Request, res: Response) => {
    const filename = req.params.filename as string;

    // Sanitize filename to prevent path traversal
    const safeName = path.basename(filename);
    const filePath = path.resolve(env.UPLOAD_DIR, 'generated', safeName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('Generated script file');
    }

    res.download(filePath, safeName);
  },
);

import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { BadRequestError } from '../middleware/error-handler.js';
import * as fileService from '../services/file-upload.service.js';
import type {
  FileProjectParam,
  FileIdParam,
  FileListQuery,
  FileUploadBody,
} from '../validators/file.validator.js';

// ---------- Upload ----------

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params as unknown as FileProjectParam;
  const file = req.file;

  if (!file) {
    throw new BadRequestError('No file was uploaded');
  }

  const body = req.body as FileUploadBody;
  const result = await fileService.handleFileUpload(
    projectId,
    file,
    body.dialect,
  );

  res.status(201).json({
    success: true,
    data: result,
  });
});

// ---------- List ----------

export const listFiles = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.params as unknown as FileProjectParam;
  const query = req.query as unknown as FileListQuery;
  const result = await fileService.listFiles(projectId, query);

  res.json({
    success: true,
    ...result,
  });
});

// ---------- Get by ID ----------

export const getFile = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, fileId } = req.params as unknown as FileIdParam;
  const file = await fileService.getFileById(projectId, fileId);

  res.json({
    success: true,
    data: file,
  });
});

// ---------- Delete ----------

export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, fileId } = req.params as unknown as FileIdParam;
  const result = await fileService.deleteFile(projectId, fileId);

  res.json({
    success: true,
    data: result,
  });
});

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  NotFoundError,
  BadRequestError,
} from '../middleware/error-handler.js';
import { buildPaginatedResponse } from '../utils/pagination.js';
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  type FileListQuery,
} from '../validators/file.validator.js';

// ------------------------------------------------------------------
// Multer configuration
// ------------------------------------------------------------------

function ensureUploadDir(): string {
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureUploadDir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    cb(new BadRequestError(`File extension '${ext}' is not allowed. Allowed: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`));
    return;
  }
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    // Be lenient with MIME types as they can be unreliable
    logger.warn(
      `Unexpected MIME type '${file.mimetype}' for file '${file.originalname}', allowing anyway`,
    );
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

// ------------------------------------------------------------------
// SHA-256 checksum
// ------------------------------------------------------------------

function computeChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ------------------------------------------------------------------
// Upload a file
// ------------------------------------------------------------------

export async function handleFileUpload(
  projectId: string,
  file: Express.Multer.File,
  dialect?: string | null,
) {
  // Verify the project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    // Clean up the uploaded file
    fs.unlinkSync(file.path);
    throw new NotFoundError('Project');
  }

  const checksum = await computeChecksum(file.path);
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

  const projectFile = await prisma.projectFile.create({
    data: {
      projectId,
      fileName: file.originalname,
      filePath: file.path,
      fileType: ext || 'unknown',
      fileSize: file.size,
      dialect: dialect ?? project.dialect,
      checksum,
    },
  });

  // Create a pending parse result
  await prisma.fileParseResult.create({
    data: {
      fileId: projectFile.id,
      status: 'pending',
    },
  });

  logger.info(
    `File uploaded: ${file.originalname} (${file.size} bytes) for project ${projectId}`,
  );

  return prisma.projectFile.findUnique({
    where: { id: projectFile.id },
    include: { parseResult: true },
  });
}

// ------------------------------------------------------------------
// List files for a project
// ------------------------------------------------------------------

export async function listFiles(projectId: string, query: FileListQuery) {
  const { page, limit, fileType } = query;
  const skip = (page - 1) * limit;

  // Verify the project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  const where: { projectId: string; fileType?: string } = { projectId };
  if (fileType) {
    where.fileType = fileType;
  }

  const [files, totalItems] = await Promise.all([
    prisma.projectFile.findMany({
      where,
      include: { parseResult: true },
      orderBy: { uploadedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.projectFile.count({ where }),
  ]);

  return buildPaginatedResponse(files, totalItems, page, limit);
}

// ------------------------------------------------------------------
// Get a single file
// ------------------------------------------------------------------

export async function getFileById(projectId: string, fileId: string) {
  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId },
    include: { parseResult: true },
  });

  if (!file) {
    throw new NotFoundError('File');
  }

  return file;
}

// ------------------------------------------------------------------
// Delete a file
// ------------------------------------------------------------------

export async function deleteFile(projectId: string, fileId: string) {
  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId },
  });

  if (!file) {
    throw new NotFoundError('File');
  }

  // Delete from disk
  try {
    if (fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }
  } catch (err) {
    logger.warn(`Failed to delete file from disk: ${file.filePath}`, {
      error: err,
    });
  }

  // Delete from database (cascades to FileParseResult)
  await prisma.projectFile.delete({
    where: { id: fileId },
  });

  return { id: fileId, deleted: true };
}

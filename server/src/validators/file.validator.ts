import { z } from 'zod';

// ---------- File upload body (metadata sent alongside the file) ----------
export const fileUploadBodySchema = z.object({
  dialect: z
    .string()
    .optional()
    .nullable(),
});

export type FileUploadBody = z.infer<typeof fileUploadBodySchema>;

// ---------- Route params ----------
export const fileProjectParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export type FileProjectParam = z.infer<typeof fileProjectParamSchema>;

export const fileIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  fileId: z.string().uuid('Invalid file ID format'),
});

export type FileIdParam = z.infer<typeof fileIdParamSchema>;

// ---------- List query ----------
export const fileListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive().max(100)),
  fileType: z.string().optional(),
});

export type FileListQuery = z.infer<typeof fileListQuerySchema>;

// Allowed file extensions for SQL / schema uploads
export const ALLOWED_FILE_EXTENSIONS = [
  '.sql',
  '.ddl',
  '.dml',
  '.txt',
  '.csv',
  '.json',
  '.xml',
  '.yaml',
  '.yml',
];

export const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/sql',
  'text/csv',
  'text/xml',
  'application/json',
  'application/xml',
  'application/x-yaml',
  'application/sql',
  'application/octet-stream',
];

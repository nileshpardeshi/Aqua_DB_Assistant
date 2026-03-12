import { z } from 'zod';

// ---------- Supported dialects ----------
const dialectEnum = z.enum([
  'postgresql',
  'mysql',
  'oracle',
  'sqlserver',
  'snowflake',
  'bigquery',
  'mongodb',
  'mariadb',
]);

const projectStatusEnum = z.enum(['active', 'inactive', 'archived']);

// ---------- Create ----------
export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(255, 'Project name must be 255 characters or fewer'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional()
    .nullable(),
  dialect: dialectEnum,
  status: projectStatusEnum.optional().default('active'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// ---------- Update ----------
export const updateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(255, 'Project name must be 255 characters or fewer')
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional()
    .nullable(),
  dialect: dialectEnum.optional(),
  status: projectStatusEnum.optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ---------- Route params ----------
export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export type ProjectIdParam = z.infer<typeof projectIdParamSchema>;

// ---------- List query ----------
export const projectListQuerySchema = z.object({
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
  search: z.string().optional(),
  status: projectStatusEnum.optional(),
  sortBy: z
    .enum(['name', 'createdAt', 'updatedAt'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

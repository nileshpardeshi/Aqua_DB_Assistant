import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { buildPaginatedResponse } from '../utils/pagination.js';
import * as auditService from './audit.service.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectListQuery,
} from '../validators/project.validator.js';

// ---------- List ----------

export async function listProjects(query: ProjectListQuery) {
  const { page, limit, search, status, sortBy, sortOrder } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ProjectWhereInput = {};

  // Filter by status (exclude archived by default unless explicitly requested)
  if (status) {
    where.status = status;
  } else {
    where.status = { not: 'archived' };
  }

  // Search by name or description
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const orderBy: Prisma.ProjectOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [projects, totalItems] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            tables: true,
            savedQueries: true,
            files: true,
            aiConversations: true,
          },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);

  // Flatten _count into top-level fields for the client
  const mapped = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    dialect: p.dialect,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    tableCount: p._count.tables,
    queryCount: p._count.savedQueries,
    fileCount: p._count.files,
    conversationCount: p._count.aiConversations,
  }));

  return buildPaginatedResponse(mapped, totalItems, page, limit);
}

// ---------- Get by ID ----------

export async function getProjectById(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: {
          files: true,
          tables: true,
          savedQueries: true,
        },
      },
    },
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  return project;
}

// ---------- Create ----------

export async function createProject(data: CreateProjectInput) {
  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      dialect: data.dialect,
      status: data.status ?? 'active',
    },
  });

  auditService.logAction({
    projectId: project.id,
    action: 'project.create',
    entity: 'Project',
    entityId: project.id,
    details: `Created project "${project.name}" (${project.dialect})`,
  }).catch(() => {});

  return project;
}

// ---------- Update ----------

export async function updateProject(
  projectId: string,
  data: UpdateProjectInput,
) {
  // Verify the project exists
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!existing) {
    throw new NotFoundError('Project');
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data,
  });

  return project;
}

// ---------- Remove (soft delete) ----------

export async function removeProject(projectId: string) {
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!existing) {
    throw new NotFoundError('Project');
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { status: 'archived' },
  });

  auditService.logAction({
    projectId: project.id,
    action: 'project.archive',
    entity: 'Project',
    entityId: project.id,
    details: `Archived project "${project.name}"`,
  }).catch(() => {});

  return project;
}

// ---------- Stats ----------

export async function getProjectStats(projectId: string) {
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!existing) {
    throw new NotFoundError('Project');
  }

  const [tableCount, queryCount, fileCount, conversationCount] =
    await Promise.all([
      prisma.tableMetadata.count({ where: { projectId } }),
      prisma.savedQuery.count({ where: { projectId } }),
      prisma.projectFile.count({ where: { projectId } }),
      prisma.aIConversation.count({ where: { projectId } }),
    ]);

  return {
    projectId,
    tables: tableCount,
    queries: queryCount,
    files: fileCount,
    conversations: conversationCount,
  };
}

// ---------- Global Stats (across all active projects) ----------

export async function getGlobalStats() {
  const activeFilter = { project: { status: { not: 'archived' } } };

  const [projects, tables, queries, conversations] = await Promise.all([
    prisma.project.count({ where: { status: { not: 'archived' } } }),
    prisma.tableMetadata.count({ where: activeFilter }),
    prisma.savedQuery.count({ where: activeFilter }),
    prisma.aIConversation.count({ where: activeFilter }),
  ]);

  return { projects, tables, queries, conversations };
}

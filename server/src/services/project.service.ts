import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { buildPaginatedResponse } from '../utils/pagination.js';
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
    }),
    prisma.project.count({ where }),
  ]);

  return buildPaginatedResponse(projects, totalItems, page, limit);
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

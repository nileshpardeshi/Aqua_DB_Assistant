import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ---------- List Saved Queries ----------

export async function listQueries(
  projectId: string,
  filters?: { search?: string; category?: string; isFavorite?: boolean },
) {
  const where: Record<string, unknown> = { projectId };

  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { sql: { contains: filters.search } },
    ];
  }

  if (filters?.category) {
    where.category = filters.category;
  }

  if (filters?.isFavorite !== undefined) {
    where.isFavorite = filters.isFavorite;
  }

  const queries = await prisma.savedQuery.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });

  return queries;
}

// ---------- Get Query by ID ----------

export async function getQueryById(id: string) {
  const query = await prisma.savedQuery.findUnique({
    where: { id },
    include: {
      executions: {
        orderBy: { executedAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!query) {
    throw new NotFoundError('SavedQuery');
  }

  return query;
}

// ---------- Create ----------

export async function createQuery(data: {
  projectId: string;
  title: string;
  description?: string;
  sql: string;
  dialect: string;
  category?: string;
  isFavorite?: boolean;
  tags?: string;
}) {
  const query = await prisma.savedQuery.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      description: data.description ?? null,
      sql: data.sql,
      dialect: data.dialect,
      category: data.category ?? null,
      isFavorite: data.isFavorite ?? false,
      tags: data.tags ?? null,
    },
  });

  return query;
}

// ---------- Update ----------

export async function updateQuery(
  id: string,
  data: {
    title?: string;
    description?: string;
    sql?: string;
    dialect?: string;
    category?: string;
    isFavorite?: boolean;
    tags?: string;
  },
) {
  const existing = await prisma.savedQuery.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('SavedQuery');
  }

  const query = await prisma.savedQuery.update({
    where: { id },
    data,
  });

  return query;
}

// ---------- Delete (soft-delete not available, hard delete) ----------

export async function deleteQuery(id: string) {
  const existing = await prisma.savedQuery.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError('SavedQuery');
  }

  await prisma.savedQuery.delete({ where: { id } });

  return existing;
}

// ---------- Create Execution ----------

export async function createExecution(data: {
  projectId: string;
  savedQueryId?: string;
  sql: string;
  dialect: string;
  status: string;
  rowsAffected?: number;
  rowsReturned?: number;
  executionTime?: number;
  resultPreview?: string;
  explainPlan?: string;
  errorMessage?: string;
}) {
  const execution = await prisma.queryExecution.create({
    data: {
      projectId: data.projectId,
      savedQueryId: data.savedQueryId ?? null,
      sql: data.sql,
      dialect: data.dialect,
      status: data.status,
      rowsAffected: data.rowsAffected ?? null,
      rowsReturned: data.rowsReturned ?? null,
      executionTime: data.executionTime ?? null,
      resultPreview: data.resultPreview ?? null,
      explainPlan: data.explainPlan ?? null,
      errorMessage: data.errorMessage ?? null,
    },
  });

  return execution;
}

// ---------- Query History ----------

export async function getQueryHistory(projectId: string, limit: number = 50) {
  const executions = await prisma.queryExecution.findMany({
    where: { projectId },
    orderBy: { executedAt: 'desc' },
    take: limit,
    include: {
      savedQuery: {
        select: { id: true, title: true },
      },
    },
  });

  return executions;
}

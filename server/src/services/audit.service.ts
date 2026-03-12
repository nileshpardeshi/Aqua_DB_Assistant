import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ---------- Log Action ----------

export async function logAction(data: {
  projectId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const log = await prisma.auditLog.create({
    data: {
      projectId: data.projectId ?? null,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId ?? null,
      details: data.details ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    },
  });

  return log;
}

// ---------- List Logs ----------

export async function listLogs(
  projectId?: string,
  filters?: {
    action?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (projectId) {
    where.projectId = projectId;
  }

  if (filters?.action) {
    where.action = filters.action;
  }

  if (filters?.entity) {
    where.entity = filters.entity;
  }

  if (filters?.startDate || filters?.endDate) {
    const createdAt: Record<string, Date> = {};
    if (filters.startDate) {
      createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      createdAt.lte = new Date(filters.endDate);
    }
    where.createdAt = createdAt;
  }

  const [logs, totalItems] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: logs,
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

// ---------- Get Log ----------

export async function getLog(id: string) {
  const log = await prisma.auditLog.findUnique({
    where: { id },
  });

  if (!log) {
    throw new NotFoundError('AuditLog');
  }

  return log;
}

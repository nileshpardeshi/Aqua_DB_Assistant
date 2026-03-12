import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ---------- Create Column Mapping ----------

export async function createColumnMapping(data: {
  projectId: string;
  name: string;
  sourceTableName: string;
  targetTableName: string;
  sourceDialect: string;
  targetDialect: string;
  mappings: string;
}) {
  const mapping = await prisma.columnMappingConfig.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      sourceTableName: data.sourceTableName,
      targetTableName: data.targetTableName,
      sourceDialect: data.sourceDialect,
      targetDialect: data.targetDialect,
      mappings: data.mappings,
    },
  });

  return mapping;
}

// ---------- List Column Mappings ----------

export async function listColumnMappings(projectId: string) {
  const mappings = await prisma.columnMappingConfig.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  });

  return mappings;
}

// ---------- Get Column Mapping ----------

export async function getColumnMapping(id: string) {
  const mapping = await prisma.columnMappingConfig.findUnique({
    where: { id },
  });

  if (!mapping) {
    throw new NotFoundError('ColumnMappingConfig');
  }

  return mapping;
}

// ---------- Update Column Mapping ----------

export async function updateColumnMapping(
  id: string,
  data: {
    name?: string;
    sourceTableName?: string;
    targetTableName?: string;
    sourceDialect?: string;
    targetDialect?: string;
    mappings?: string;
  },
) {
  const existing = await prisma.columnMappingConfig.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('ColumnMappingConfig');
  }

  const mapping = await prisma.columnMappingConfig.update({
    where: { id },
    data,
  });

  return mapping;
}

// ---------- Delete Column Mapping ----------

export async function deleteColumnMapping(id: string) {
  const existing = await prisma.columnMappingConfig.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('ColumnMappingConfig');
  }

  await prisma.columnMappingConfig.delete({ where: { id } });

  return existing;
}

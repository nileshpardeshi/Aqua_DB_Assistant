import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ---------- Create Data Sheet Mapping ----------

export async function createDataSheetMapping(data: {
  projectId: string;
  name: string;
  sourceTableName: string;
  csvFileName: string;
  mappings: string;
}) {
  const mapping = await prisma.dataSheetMappingConfig.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      sourceTableName: data.sourceTableName,
      csvFileName: data.csvFileName,
      mappings: data.mappings,
    },
  });

  return mapping;
}

// ---------- List Data Sheet Mappings ----------

export async function listDataSheetMappings(projectId: string) {
  const mappings = await prisma.dataSheetMappingConfig.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  });

  return mappings;
}

// ---------- Get Data Sheet Mapping ----------

export async function getDataSheetMapping(id: string) {
  const mapping = await prisma.dataSheetMappingConfig.findUnique({
    where: { id },
  });

  if (!mapping) {
    throw new NotFoundError('DataSheetMappingConfig');
  }

  return mapping;
}

// ---------- Update Data Sheet Mapping ----------

export async function updateDataSheetMapping(
  id: string,
  data: {
    name?: string;
    sourceTableName?: string;
    csvFileName?: string;
    mappings?: string;
  },
) {
  const existing = await prisma.dataSheetMappingConfig.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('DataSheetMappingConfig');
  }

  const mapping = await prisma.dataSheetMappingConfig.update({
    where: { id },
    data,
  });

  return mapping;
}

// ---------- Delete Data Sheet Mapping ----------

export async function deleteDataSheetMapping(id: string) {
  const existing = await prisma.dataSheetMappingConfig.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('DataSheetMappingConfig');
  }

  await prisma.dataSheetMappingConfig.delete({ where: { id } });

  return existing;
}

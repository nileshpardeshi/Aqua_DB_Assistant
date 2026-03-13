import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';

// ---------- Create Saved Diagram ----------

export async function createSavedDiagram(data: {
  projectId: string;
  name: string;
  description?: string;
  diagramType: string;
  includedTables?: string;
  nodePositions?: string;
  layoutDirection?: string;
  showColumns?: boolean;
  showLabels?: boolean;
  colorBySchema?: boolean;
  annotations?: string;
  isDefault?: boolean;
}) {
  return prisma.savedDiagram.create({ data });
}

// ---------- List Saved Diagrams ----------

export async function listSavedDiagrams(projectId: string) {
  return prisma.savedDiagram.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  });
}

// ---------- Get Saved Diagram ----------

export async function getSavedDiagram(id: string) {
  const diagram = await prisma.savedDiagram.findUnique({ where: { id } });
  if (!diagram) throw new NotFoundError('SavedDiagram');
  return diagram;
}

// ---------- Update Saved Diagram ----------

export async function updateSavedDiagram(
  id: string,
  data: {
    name?: string;
    description?: string;
    diagramType?: string;
    includedTables?: string;
    nodePositions?: string;
    layoutDirection?: string;
    showColumns?: boolean;
    showLabels?: boolean;
    colorBySchema?: boolean;
    annotations?: string;
    isDefault?: boolean;
  },
) {
  const existing = await prisma.savedDiagram.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('SavedDiagram');
  return prisma.savedDiagram.update({ where: { id }, data });
}

// ---------- Delete Saved Diagram ----------

export async function deleteSavedDiagram(id: string) {
  const existing = await prisma.savedDiagram.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('SavedDiagram');
  await prisma.savedDiagram.delete({ where: { id } });
  return existing;
}

// ---------- Duplicate Saved Diagram ----------

export async function duplicateSavedDiagram(id: string) {
  const existing = await prisma.savedDiagram.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('SavedDiagram');

  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existing;
  return prisma.savedDiagram.create({
    data: { ...rest, name: `${rest.name} (Copy)`, isDefault: false },
  });
}
